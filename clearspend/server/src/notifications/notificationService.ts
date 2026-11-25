
// Business rules for notifications. This module does not update budgets,
// expenses, or savings goals; the owning modules call these functions after
// successfully saving their own changes.

export type NotificationType =
    | "goal_completed"
    | "goal_modified"
    | "budget_80_percent"
    | "budget_exceeded";

export type RelatedType = "goal" | "budget";

export interface NotificationInput {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    relatedId: string;
    relatedType: RelatedType;
    dedupeKey: string;
}

export interface NotificationRepository {
    create(input: NotificationInput): Promise<unknown | null>;
}

interface GoalCompletedInput {
    userId: string;
    goalId: string;
    goalName: string;
}

interface GoalModifiedInput {
    userId: string;
    goalId: string;
    goalName: string;
    targetAmountChanged: boolean;
    deadlineChanged: boolean;
    eventId: string;
}

interface BudgetProgressInput {
    userId: string;
    budgetId: string;
    budgetName?: string;
    budgetAmount: number | string;
    totalSpent: number | string;
    periodKey: string;
}

export function createNotificationService(
    repository: NotificationRepository
) {
    if (!repository) {
        throw new Error("Notification repository is required.");
    }

    async function goalCompleted({
        userId,
        goalId,
        goalName
    }: GoalCompletedInput) {
        return repository.create({
            userId,
            type: "goal_completed",
            title: "Savings goal completed!",
            message: `Congratulations! You have completed your savings goal: ${goalName}.`,
            relatedId: goalId,
            relatedType: "goal",
            dedupeKey: `goal:${goalId}:completed`
        });
    }

    async function goalModified({
        userId,
        goalId,
        goalName,
        targetAmountChanged,
        deadlineChanged,
        eventId
    }: GoalModifiedInput) {
        if (!targetAmountChanged && !deadlineChanged) {
            return null;
        }

        if (!eventId) {
            throw new Error(
                "eventId is required so separate goal edits are recorded correctly."
            );
        }

        const changes: string[] = [];

        if (targetAmountChanged) {
            changes.push("target amount");
        }

        if (deadlineChanged) {
            changes.push("deadline");
        }

        return repository.create({
            userId,
            type: "goal_modified",
            title: "Savings goal updated",
            message: `The ${changes.join(" and ")} for "${goalName}" ${changes.length === 1 ? "has" : "have"} been changed.`,
            relatedId: goalId,
            relatedType: "goal",
            dedupeKey: `goal:${goalId}:modified:${eventId}`
        });
    }

    async function checkBudgetProgress({
        userId,
        budgetId,
        budgetName,
        budgetAmount,
        totalSpent,
        periodKey
    }: BudgetProgressInput) {
        const amount = Number(budgetAmount);
        const spent = Number(totalSpent);

        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error(
                "budgetAmount must be greater than zero."
            );
        }

        if (!Number.isFinite(spent) || spent < 0) {
            throw new Error(
                "totalSpent must be zero or greater."
            );
        }

        if (!periodKey) {
            throw new Error(
                "periodKey is required to distinguish budget periods."
            );
        }

        const percentage = (spent / amount) * 100;
        const name = budgetName || "your budget";
        const created: unknown[] = [];

        // FR4: Alert when spending reaches 80% of the budget limit.
        if (percentage >= 80) {
            const notification = await repository.create({
                userId,
                type: "budget_80_percent",
                title: "You have used 80% of your budget",
                message: `You have spent ${percentage.toFixed(1)}% of ${name}. Review your spending to help stay within your limit.`,
                relatedId: budgetId,
                relatedType: "budget",
                dedupeKey: `budget:${budgetId}:${periodKey}:80-percent`
            });

            if (notification) {
                created.push(notification);
            }
        }

        // FR4: Spending must exceed 100% to trigger this alert.
        if (percentage > 100) {
            const notification = await repository.create({
                userId,
                type: "budget_exceeded",
                title: "You have exceeded your budget",
                message: `You have spent ${percentage.toFixed(1)}% of ${name}, which is above your established limit.`,
                relatedId: budgetId,
                relatedType: "budget",
                dedupeKey: `budget:${budgetId}:${periodKey}:exceeded`
            });

            if (notification) {
                created.push(notification);
            }
        }

        return {
            percentage,
            notificationsCreated: created
        };
    }

    return {
        goalCompleted,
        goalModified,
        checkBudgetProgress
    };
}
