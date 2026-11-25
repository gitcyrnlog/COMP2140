import { useCallback, useEffect, useState } from "react";
import type { AppNotification } from "../models/Goal";
import NotificationList from "../components/notifications/NotificationList";
import {
    listNotifications,
    markNotificationRead
} from "../services/NotificationService";
import "../styles/notifications.css";

type ViewFilter = "all" | "unread";

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [filter, setFilter] = useState<ViewFilter>("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const loadNotifications = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await listNotifications(false);
            setNotifications(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to load notifications.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadNotifications();
    }, [loadNotifications]);

    async function handleMarkRead(notification: AppNotification) {
        setBusyId(notification.id);
        const previous = notifications;
        setNotifications((current) => current.map((item) =>
            item.id === notification.id ? { ...item, read: true } : item
        ));
        try {
            await markNotificationRead(notification.id);
        } catch (err) {
            setNotifications(previous);
            setError(err instanceof Error ? err.message : "Unable to update notification.");
        } finally {
            setBusyId(null);
        }
    }

    const visibleNotifications = filter === "unread"
        ? notifications.filter((notification) => !notification.read)
        : notifications;
    const unreadCount = notifications.filter((notification) => !notification.read).length;

    return (
        <main className="notifications-page">
            <header className="notifications-page__header">
                <div>
                    <p className="notifications-page__eyebrow">CLEARSPEND</p>
                    <h1>Notifications</h1>
                    <p className="notifications-page__subtitle">
                        Keep up with your budgets, savings goals and progress.
                    </p>
                </div>
                <div className="notifications-page__count" aria-live="polite">
                    <strong>{unreadCount}</strong>
                    <span>unread</span>
                </div>
            </header>

            <nav className="notification-filters" aria-label="Notification filters">
                <button
                    type="button"
                    className={filter === "all" ? "is-active" : ""}
                    onClick={() => setFilter("all")}
                    aria-pressed={filter === "all"}
                >All notifications</button>
                <button
                    type="button"
                    className={filter === "unread" ? "is-active" : ""}
                    onClick={() => setFilter("unread")}
                    aria-pressed={filter === "unread"}
                >Unread ({unreadCount})</button>
                <button type="button" className="notification-refresh" onClick={() => void loadNotifications()}>
                    Refresh
                </button>
            </nav>

            {error && <div className="notification-error" role="alert">{error}</div>}
            {loading ? (
                <div className="notification-empty" role="status">Loading notifications…</div>
            ) : (
                <NotificationList
                    notifications={visibleNotifications}
                    onMarkRead={handleMarkRead}
                    busyId={busyId}
                    emptyMessage={filter === "unread" ? "You have no unread notifications." : "Your notification history is empty."}
                />
            )}
        </main>
    );
}
