// FR1 "Check Goal Alerts": milestone and behind-schedule alerts. Alerts are delivered through the
// Notification and Progress module (FR4) via createNotification().
import type pg from "pg";
import { createNotification } from "../utility/notifications.js";
import type { NotificationRow } from "../utility/notifications.js";
import { formatJmd, MILESTONES, paceFor, percentComplete } from "../utility/financialCalc.js";
import type { Milestone } from "../utility/financialCalc.js";
import { todayInJamaica } from "../utility/dates.js";
import { listIncompleteGoals, setBehindFlag } from "./goalRepository.js";
import type { GoalRow, Queryable } from "./goalRepository.js";

export function milestoneMessage(goal: GoalRow, milestone: Milestone): string {
    const progress = `${formatJmd(goal.savedAmountCents)} of ${formatJmd(goal.targetAmountCents)}`;
    return milestone === 100
        ? `Congratulations! You completed your "${goal.name}" goal (${progress}).`
        : `You reached ${milestone}% of your "${goal.name}" goal (${progress}).`;
}

export async function notifyMilestones(
    db: Queryable,
    goal: GoalRow,
    milestones: Milestone[],
): Promise<NotificationRow[]> {
    const created: NotificationRow[] = [];
    for (const m of MILESTONES.filter((x) => milestones.includes(x))) {
        const note = await createNotification(db, {
            userId: goal.userId,
            goalId: goal.id,
            type: `goal_milestone_${m}`,
            message: milestoneMessage(goal, m),
        });
        if (note) created.push(note);
    }
    return created;
}

/**
 * Sends ONE "behind schedule" alert when a goal falls behind its required pace and re-arms when the goal
 * is back on pace. Goals that are on schedule, ahead of schedule or completed never produce an alert.
 */
export async function evaluateBehindSchedule(db: Queryable, goal: GoalRow, today: string): Promise<NotificationRow | null> {
    const pace = paceFor({
        savedCents: goal.savedAmountCents,
        targetCents: goal.targetAmountCents,
        startDate: goal.startDate,
        targetDate: goal.targetDate,
        today,
    });
    if (pace.status !== "behind") {
        if (goal.behindAlertActive) await setBehindFlag(db, goal.id, false);
        return null;
    }
    const flipped = await setBehindFlag(db, goal.id, true);
    if (!flipped) return null; // already alerted for this stretch of being behind
    const percent = percentComplete(goal.savedAmountCents, goal.targetAmountCents);
    return createNotification(db, {
        userId: goal.userId,
        goalId: goal.id,
        type: "goal_behind_schedule",
        message:
            `Your "${goal.name}" goal is behind schedule: ${percent}% saved. ` +
            `Save about ${formatJmd(pace.requiredPerDayCents)} per day to reach ${formatJmd(goal.targetAmountCents)} by ${goal.targetDate}.`,
    });
}

/** Runs the behind-schedule check for all of one user's goals (or every user's goals when userId is omitted). */
export async function evaluateAllGoals(db: Queryable, today: string, userId?: string): Promise<NotificationRow[]> {
    const created: NotificationRow[] = [];
    for (const goal of await listIncompleteGoals(db, userId)) {
        const note = await evaluateBehindSchedule(db, goal, today);
        if (note) created.push(note);
    }
    return created;
}

/** Scheduler job (SDS: Scheduler triggers goal deadline checks): re-checks every goal once an hour. */
export function startGoalAlertScheduler(pool: pg.Pool, intervalMs = 60 * 60 * 1000): NodeJS.Timeout {
    const run = () => {
        evaluateAllGoals(pool, todayInJamaica()).catch(() => console.error("Goal alert check failed."));
    };
    run();
    const timer = setInterval(run, intervalMs);
    timer.unref();
    return timer;
}
