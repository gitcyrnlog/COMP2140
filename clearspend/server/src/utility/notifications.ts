// Utility / FR4 integration point. Goal Management (FR1) raises alerts through createNotification();
// Notification and Progress (FR4) reads them back as the notification history.
import { randomUUID } from "node:crypto";
import { Router } from "express";
import type pg from "pg";
import { requireAuth, userIdOf } from "../auth/session.js";

export interface NotificationRow {
    id: string;
    goalId: string | null;
    type: string;
    message: string;
    createdAt: string;
    read: boolean;
}

interface DbNotification {
    id: string;
    goal_id: string | null;
    type: string;
    message: string;
    created_at: Date;
    read_at: Date | null;
}

function toView(row: DbNotification): NotificationRow {
    return {
        id: row.id,
        goalId: row.goal_id,
        type: row.type,
        message: row.message,
        createdAt: row.created_at.toISOString(),
        read: row.read_at !== null,
    };
}

type Queryable = Pick<pg.Pool, "query">;

/** Stores a notification. Returns null when an identical one-time milestone alert already exists. */
export async function createNotification(
    db: Queryable,
    input: { userId: string; goalId: string | null; type: string; message: string },
): Promise<NotificationRow | null> {
    const result = await db.query<DbNotification>(
        `INSERT INTO notifications (id, user_id, goal_id, type, message)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id, goal_id, type, message, created_at, read_at`,
        [randomUUID(), input.userId, input.goalId, input.type, input.message],
    );
    return result.rows[0] ? toView(result.rows[0]) : null;
}

export function createNotificationsRouter(pool: pg.Pool): Router {
    const router = Router();
    router.use("/api/notifications", requireAuth(pool));

    // Notification history, newest first. ?unread=true returns only unread alerts.
    router.get("/api/notifications", async (req, res, next) => {
        try {
            const unreadOnly = req.query.unread === "true";
            const result = await pool.query<DbNotification>(
                `SELECT id, goal_id, type, message, created_at, read_at
                 FROM notifications
                 WHERE user_id = $1 ${unreadOnly ? "AND read_at IS NULL" : ""}
                 ORDER BY created_at DESC, id
                 LIMIT 100`,
                [userIdOf(res)],
            );
            res.json({ notifications: result.rows.map(toView) });
        } catch (error) {
            next(error);
        }
    });

    router.post("/api/notifications/:id/read", async (req, res, next) => {
        try {
            const id = String(req.params.id);
            if (!/^[0-9a-f-]{36}$/i.test(id)) {
                res.status(404).json({ message: "Notification not found." });
                return;
            }
            const result = await pool.query(
                `UPDATE notifications SET read_at = COALESCE(read_at, now())
                 WHERE id = $1 AND user_id = $2`,
                [id, userIdOf(res)],
            );
            if (result.rowCount === 0) {
                res.status(404).json({ message: "Notification not found." });
                return;
            }
            res.status(204).end();
        } catch (error) {
            next(error);
        }
    });

    return router;
}
