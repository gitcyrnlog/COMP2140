// Application Services: Goal Management (FR1). Business rules for creating, tracking, modifying,
// deleting and sorting savings goals. Uses Data Management (goalRepository), Financial Calculation
// Services (financialCalc) and the Notification module (FR4) for alerts.
import { randomUUID } from "node:crypto";
import type pg from "pg";
import { newlyReachedMilestones, centsToDollars, dollarsToCents, formatJmd, paceFor, percentComplete } from "../utility/financialCalc.js";
import type { PaceStatus } from "../utility/financialCalc.js";
import { createNotification } from "../utility/notifications.js";
import type { NotificationRow } from "../utility/notifications.js";
import { evaluateAllGoals, evaluateBehindSchedule, notifyMilestones } from "./goalAlerts.js";
import {
    addContributionRow,
    defaultOrderFor,
    deleteGoalRow,
    findGoal,
    insertGoal,
    listGoals,
    updateGoalRow,
} from "./goalRepository.js";
import type { GoalRow } from "./goalRepository.js";
import type { Priority, SortField, SortOrder } from "./goalSchemas.js";

export class GoalError extends Error {
    constructor(
        public status: number,
        message: string,
        public extra: Record<string, unknown> = {},
    ) {
        super(message);
    }
}

export interface GoalView {
    id: string;
    name: string;
    targetAmount: number;
    savedAmount: number;
    remainingAmount: number;
    percentComplete: number;
    targetDate: string;
    startDate: string;
    priority: Priority;
    status: PaceStatus;
    daysLeft: number;
    requiredPerDay: number;
    completedAt: string | null;
    createdAt: string;
}

export function toGoalView(goal: GoalRow, today: string): GoalView {
    const pace = paceFor({
        savedCents: goal.savedAmountCents,
        targetCents: goal.targetAmountCents,
        startDate: goal.startDate,
        targetDate: goal.targetDate,
        today,
    });
    return {
        id: goal.id,
        name: goal.name,
        targetAmount: centsToDollars(goal.targetAmountCents),
        savedAmount: centsToDollars(goal.savedAmountCents),
        remainingAmount: centsToDollars(Math.max(goal.targetAmountCents - goal.savedAmountCents, 0)),
        percentComplete: percentComplete(goal.savedAmountCents, goal.targetAmountCents),
        targetDate: goal.targetDate,
        startDate: goal.startDate,
        priority: goal.priority,
        status: pace.status,
        daysLeft: pace.daysLeft,
        requiredPerDay: centsToDollars(pace.requiredPerDayCents),
        completedAt: goal.completedAt,
        createdAt: goal.createdAt,
    };
}

export interface GoalsServiceDeps {
    pool: pg.Pool;
    /** Today's date in Jamaica (YYYY-MM-DD). Replaced by a fixed date in tests. */
    today: () => string;
}

function futureDateError(): GoalError {
    return new GoalError(400, "Target date must be a future date.", {
        errors: { targetDate: "Target date must be a future date." },
    });
}

export function createGoalsService({ pool, today }: GoalsServiceDeps) {
    async function inTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const result = await work(client);
            await client.query("COMMIT");
            return result;
        } catch (error) {
            await client.query("ROLLBACK").catch(() => undefined);
            throw error;
        } finally {
            client.release();
        }
    }

    return {
        /** AC-2.1 Valid goal creation. Rejects a past or present target date. */
        async createGoal(
            userId: string,
            input: { name: string; targetAmount: number; targetDate: string; priority?: Priority },
        ): Promise<GoalView> {
            const now = today();
            if (input.targetDate <= now) throw futureDateError();
            const goal = await insertGoal(pool, {
                id: randomUUID(),
                userId,
                name: input.name,
                targetAmountCents: dollarsToCents(input.targetAmount),
                targetDate: input.targetDate,
                startDate: now,
                priority: input.priority ?? "medium",
            });
            return toGoalView(goal, now);
        },

        /** AC-2.5 Sorting. Also runs the behind-schedule check so alerts are never stale. */
        async listGoals(userId: string, sort: SortField, order?: SortOrder): Promise<GoalView[]> {
            const now = today();
            await evaluateAllGoals(pool, now, userId);
            const goals = await listGoals(pool, userId, sort, order ?? defaultOrderFor(sort));
            return goals.map((g) => toGoalView(g, now));
        },

        /** AC-2.2 / AC-2.3: records a contribution, updates progress immediately and raises alerts. */
        async addContribution(
            userId: string,
            goalId: string,
            amount: number,
        ): Promise<{ goal: GoalView; alerts: NotificationRow[] }> {
            const now = today();
            return inTransaction(async (db) => {
                const before = await findGoal(db, userId, goalId, true);
                if (!before) throw new GoalError(404, "Goal not found.");
                const amountCents = dollarsToCents(amount);
                const savedAfter = before.savedAmountCents + amountCents;
                const milestones = newlyReachedMilestones(
                    { savedCents: before.savedAmountCents, targetCents: before.targetAmountCents },
                    { savedCents: savedAfter, targetCents: before.targetAmountCents },
                );
                const after = await addContributionRow(
                    db,
                    { id: randomUUID(), goalId, amountCents },
                    savedAfter >= before.targetAmountCents,
                );
                const alerts = await notifyMilestones(db, after, milestones);
                const behind = await evaluateBehindSchedule(db, after, now);
                if (behind) alerts.push(behind);
                return { goal: toGoalView(after, now), alerts };
            });
        },

        /** AC-2.4 Editing. Decreasing the target amount needs explicit confirmation. */
        async updateGoal(
            userId: string,
            goalId: string,
            input: { name?: string; targetAmount?: number; targetDate?: string; priority?: Priority; confirmDecrease?: boolean },
        ): Promise<{ goal: GoalView; alerts: NotificationRow[] }> {
            const now = today();
            return inTransaction(async (db) => {
                const before = await findGoal(db, userId, goalId, true);
                if (!before) throw new GoalError(404, "Goal not found.");

                const targetAmountCents =
                    input.targetAmount !== undefined ? dollarsToCents(input.targetAmount) : before.targetAmountCents;
                if (targetAmountCents < before.targetAmountCents && input.confirmDecrease !== true) {
                    throw new GoalError(
                        409,
                        `Decreasing the target from ${formatJmd(before.targetAmountCents)} to ${formatJmd(targetAmountCents)} needs your confirmation.`,
                        { requiresConfirmation: true, action: "decrease_target" },
                    );
                }
                const targetDate = input.targetDate ?? before.targetDate;
                if (input.targetDate !== undefined && input.targetDate !== before.targetDate && input.targetDate <= now) {
                    throw futureDateError();
                }

                const completed = before.savedAmountCents >= targetAmountCents;
                const after = await updateGoalRow(db, goalId, {
                    name: input.name ?? before.name,
                    targetAmountCents,
                    targetDate,
                    priority: input.priority ?? before.priority,
                    completed,
                });

                const alerts: NotificationRow[] = [];
                const milestones = newlyReachedMilestones(
                    { savedCents: before.savedAmountCents, targetCents: before.targetAmountCents },
                    { savedCents: after.savedAmountCents, targetCents: after.targetAmountCents },
                );
                alerts.push(...(await notifyMilestones(db, after, milestones)));

                // FR4: a change to the target amount or deadline is also reported in the notification history.
                if (targetAmountCents !== before.targetAmountCents || targetDate !== before.targetDate) {
                    const changed = await createNotification(db, {
                        userId,
                        goalId,
                        type: "goal_modified",
                        message:
                            `Your "${after.name}" goal was updated: target ${formatJmd(after.targetAmountCents)} by ${after.targetDate} ` +
                            `(was ${formatJmd(before.targetAmountCents)} by ${before.targetDate}).`,
                    });
                    if (changed) alerts.push(changed);
                }
                const behind = await evaluateBehindSchedule(db, after, now);
                if (behind) alerts.push(behind);
                return { goal: toGoalView(after, now), alerts };
            });
        },

        /** AC-2.4 Deleting needs confirmation. Without it nothing is deleted. */
        async deleteGoal(userId: string, goalId: string, confirmed: boolean): Promise<void> {
            const goal = await findGoal(pool, userId, goalId);
            if (!goal) throw new GoalError(404, "Goal not found.");
            if (!confirmed) {
                throw new GoalError(409, `Deleting "${goal.name}" needs your confirmation.`, {
                    requiresConfirmation: true,
                    action: "delete_goal",
                });
            }
            await deleteGoalRow(pool, userId, goalId);
        },
    };
}

export type GoalsService = ReturnType<typeof createGoalsService>;
