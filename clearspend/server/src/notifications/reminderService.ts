
export interface ReminderNotificationInput {
    userId: string;
    type: "savings_goal_reminder";
    title: string;
    message: string;
    relatedId: string;
    relatedType: "goal";
    dedupeKey: string;
}

export interface ReminderNotificationRepository {
    create(input: ReminderNotificationInput): Promise<unknown | null>;
}

export interface ReminderGoal {
    userId: string;
    goalId: string;
    goalName: string;
}

export interface ReminderService {
    remindAboutGoal(
        input: ReminderGoal & { reminderPeriodKey: string }
    ): Promise<unknown | null>;

    sendReminders(
        goals: ReminderGoal[],
        reminderPeriodKey: string
    ): Promise<unknown[]>;
}

export function createReminderService(
    notificationRepository: ReminderNotificationRepository
): ReminderService {
    async function remindAboutGoal({
        userId,
        goalId,
        goalName,
        reminderPeriodKey
    }: ReminderGoal & { reminderPeriodKey: string }): Promise<unknown | null> {
        if (!reminderPeriodKey) {
            throw new Error("reminderPeriodKey is required.");
        }

        return notificationRepository.create({
            userId,
            type: "savings_goal_reminder",
            title: "A little savings reminder",
            message: `Take a moment to review your progress on "${goalName}" and keep working towards your savings target.`,
            relatedId: goalId,
            relatedType: "goal",
            dedupeKey: `goal:${goalId}:reminder:${reminderPeriodKey}`
        });
    }

    async function sendReminders(
        goals: ReminderGoal[],
        reminderPeriodKey: string
    ): Promise<unknown[]> {
        const results: unknown[] = [];

        for (const goal of goals) {
            const notification = await remindAboutGoal({
                ...goal,
                reminderPeriodKey
            });

            if (notification) results.push(notification);
        }

        return results;
    }

    return { remindAboutGoal, sendReminders };
}
