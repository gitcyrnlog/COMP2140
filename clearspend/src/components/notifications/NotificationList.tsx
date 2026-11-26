import type { AppNotification } from "../../models/Goal";
import NotificationCard from "./NotificationCard";

interface NotificationListProps {
    notifications: AppNotification[];
    onMarkRead?: (notification: AppNotification) => void;
    busyId?: string | null;
    emptyMessage?: string;
}

export default function NotificationList({
    notifications,
    onMarkRead,
    busyId = null,
    emptyMessage = "You're all caught up. No notifications to show."
}: NotificationListProps) {
    if (notifications.length === 0) {
        return <div className="notification-empty">{emptyMessage}</div>;
    }

    return (
        <div className="notification-list">
            {notifications.map((notification) => (
                <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onMarkRead={onMarkRead}
                    busy={busyId === notification.id}
                />
            ))}
        </div>
    );
}
