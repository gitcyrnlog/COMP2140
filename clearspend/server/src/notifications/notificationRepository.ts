
export interface NotificationInput {
    userId: string;
    type: string;
    title: string;
    message: string;
    relatedId?: string | null;
    relatedType?: string | null;
    dedupeKey: string;
}

export interface NotificationRecord {
    notification_id: string;
    user_id?: string;
    notification_type: string;
    title: string;
    message: string;
    related_id: string | null;
    related_type: string | null;
    is_read: boolean;
    created_at: Date | string;
}

interface QueryResult<Row> {
    rows: Row[];
}

export interface DatabaseClient {
    query<Row = Record<string, unknown>>(
        sql: string,
        values?: unknown[]
    ): Promise<QueryResult<Row>>;
}

export interface NotificationRepository {
    create(notification: NotificationInput): Promise<NotificationRecord | null>;
    getHistory(userId: string, limit?: number, offset?: number): Promise<NotificationRecord[]>;
    getUnread(userId: string, limit?: number, offset?: number): Promise<NotificationRecord[]>;
    getDetails(userId: string, notificationId: string): Promise<NotificationRecord | null>;
    markAsRead(userId: string, notificationId: string): Promise<NotificationRecord | null>;
    getUnreadCount(userId: string): Promise<number>;
}

export function createNotificationRepository(
    db: DatabaseClient
): NotificationRepository {
    if (!db || typeof db.query !== "function") {
        throw new Error("A PostgreSQL database pool/client is required.");
    }

    async function create(
        notification: NotificationInput
    ): Promise<NotificationRecord | null> {
        const {
            userId, type, title, message,
            relatedId = null, relatedType = null, dedupeKey
        } = notification;

        const result = await db.query<NotificationRecord>(
            `INSERT INTO notifications
                 (user_id, notification_type, title, message, related_id, related_type, dedupe_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id, dedupe_key) DO NOTHING
             RETURNING notification_id, user_id, notification_type, title, message,
                       related_id, related_type, is_read, created_at`,
            [userId, type, title, message, relatedId, relatedType, dedupeKey]
        );

        return result.rows[0] ?? null;
    }

    async function getHistory(
        userId: string,
        limit = 50,
        offset = 0
    ): Promise<NotificationRecord[]> {
        const result = await db.query<NotificationRecord>(
            `SELECT notification_id, notification_type, title, message,
                    related_id, related_type, is_read, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC, notification_id DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        return result.rows;
    }

    async function getUnread(
        userId: string,
        limit = 50,
        offset = 0
    ): Promise<NotificationRecord[]> {
        const result = await db.query<NotificationRecord>(
            `SELECT notification_id, notification_type, title, message,
                    related_id, related_type, is_read, created_at
             FROM notifications
             WHERE user_id = $1 AND is_read = FALSE
             ORDER BY created_at DESC, notification_id DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        return result.rows;
    }

    async function getDetails(
        userId: string,
        notificationId: string
    ): Promise<NotificationRecord | null> {
        const result = await db.query<NotificationRecord>(
            `SELECT notification_id, notification_type, title, message,
                    related_id, related_type, is_read, created_at
             FROM notifications
             WHERE user_id = $1 AND notification_id = $2`,
            [userId, notificationId]
        );

        return result.rows[0] ?? null;
    }

    async function markAsRead(
        userId: string,
        notificationId: string
    ): Promise<NotificationRecord | null> {
        const result = await db.query<NotificationRecord>(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE user_id = $1 AND notification_id = $2
             RETURNING notification_id, notification_type, title, message,
                       related_id, related_type, is_read, created_at`,
            [userId, notificationId]
        );

        return result.rows[0] ?? null;
    }

    async function getUnreadCount(userId: string): Promise<number> {
        const result = await db.query<{ unread_count: number }>(
            `SELECT COUNT(*)::INT AS unread_count
             FROM notifications
             WHERE user_id = $1 AND is_read = FALSE`,
            [userId]
        );

        return result.rows[0]?.unread_count ?? 0;
    }

    return {
        create,
        getHistory,
        getUnread,
        getDetails,
        markAsRead,
        getUnreadCount
    };
}

