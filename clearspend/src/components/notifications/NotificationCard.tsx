import type { AppNotification } from "../../models/Goal";

interface NotificationCardProps {
    notification: AppNotification;
    onMarkRead?: (notification: AppNotification) => void;
    busy?: boolean;
}

function getCategory(type: string): string {
    const value = type.toLowerCase();
    if (value.includes("budget") || value.includes("over_budget") || value.includes("80")) return "budget";
    if (value.includes("goal") || value.includes("completed") || value.includes("modified")) return "goal";
    if (value.includes("reminder")) return "reminder";
    return "general";
}

export default function NotificationCard({ notification, onMarkRead, busy = false }: NotificationCardProps) {
    const category = getCategory(notification.type);
    const date = new Date(notification.createdAt);
    const dateLabel = Number.isNaN(date.getTime())
        ? notification.createdAt
        : date.toLocaleString();

    return (
        <article className={`notification-card ${notification.read ? "is-read" : "is-unread"}`}>
            <div className="notification-card__indicator" aria-hidden="true" />
            <div className="notification-card__content">
                <div className="notification-card__meta">
                    <span className={`notification-tag notification-tag--${category}`}>{category}</span>
                    <time dateTime={notification.createdAt}>{dateLabel}</time>
                </div>
                <p className="notification-card__message">{notification.message}</p>
                {!notification.read && onMarkRead && (
                    <button
                        type="button"
                        className="notification-text-button"
                        onClick={() => onMarkRead(notification)}
                        disabled={busy}
                    >
                        {busy ? "Marking as read…" : "Mark as read"}
                    </button>
                )}
                {notification.read && <span className="notification-read-label">Read</span>}
            </div>
        </article>
    );
}
