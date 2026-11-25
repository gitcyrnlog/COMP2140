
import { api } from "./ApiClient";

export type NotificationType =
    | "goal_completed"
    | "goal_modified"
    | "budget_warning"
    | "budget_exceeded"
    | "savings_reminder"
    | string;

export interface AppNotification {
    id: string;
    goalId: string | null;
    type: NotificationType;
    message: string;
    createdAt: string;
    read: boolean;
}

interface NotificationListResponse {
    notifications: AppNotification[];
}

interface UnreadCountResponse {
    count: number;
}

// Retrieve notifications, including optional unread-only filtering.
export async function listNotifications(
    unreadOnly = false
): Promise<AppNotification[]> {
    const query = unreadOnly ? "?unread=true" : "";

    const response = await api<NotificationListResponse>(
        `/api/notifications${query}`
    );

    return response.notifications;
}

// Retrieve unread notifications.
export async function unreadNotifications(): Promise<AppNotification[]> {
    return listNotifications(true);
}

// Retrieve all notification history.
export async function notificationHistory(): Promise<AppNotification[]> {
    return listNotifications(false);
}

// Retrieve the unread notification count.
export async function unreadNotificationCount(): Promise<number> {
    const response = await api<UnreadCountResponse>(
        "/api/notifications/unread-count"
    );

    return response.count;
}

// Mark an individual notification as read.
export async function markNotificationRead(id: string): Promise<void> {
    await api<void>(
        `/api/notifications/${encodeURIComponent(id)}/read`,
        { method: "POST" }
    );
}

// Mark all notifications as read.
export async function markAllNotificationsRead(): Promise<void> {
    await api<void>("/api/notifications/read-all", {
        method: "POST"
    });
}

const notificationService = {
    listNotifications,
    unreadNotifications,
    notificationHistory,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead
};

export default notificationService;
