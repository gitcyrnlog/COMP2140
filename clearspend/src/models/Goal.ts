export type Priority = "high" | "medium" | "low";
export type GoalStatus = "completed" | "behind" | "on_track";
export type SortField = "priority" | "targetDate" | "targetAmount";
export type SortOrder = "asc" | "desc";

/** A savings goal as returned by the API (amounts are in JMD). */
export interface Goal {
    id: string;
    name: string;
    targetAmount: number;
    savedAmount: number;
    remainingAmount: number;
    percentComplete: number;
    targetDate: string;
    startDate: string;
    priority: Priority;
    status: GoalStatus;
    daysLeft: number;
    requiredPerDay: number;
    completedAt: string | null;
    createdAt: string;
}

export interface GoalInput {
    name: string;
    targetAmount: number;
    targetDate: string;
    priority: Priority;
}

export interface AppNotification {
    id: string;
    goalId: string | null;
    type: string;
    message: string;
    createdAt: string;
    read: boolean;
}
