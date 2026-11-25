interface NotificationBellProps {
    unreadCount: number;
    onClick: () => void;
}

export default function NotificationBell({ unreadCount, onClick }: NotificationBellProps) {
    return (
        <button
            type="button"
            className="notification-bell"
            onClick={onClick}
            aria-label={`Open notifications. ${unreadCount} unread`}
        >
            <span aria-hidden="true">🔔</span>
            {unreadCount > 0 && (
                <span className="notification-bell__count">
                    {unreadCount > 99 ? "99+" : unreadCount}
                </span>
            )}
        </button>
    );
}
