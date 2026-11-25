
import express, {
    type Request,
    type Response,
    type NextFunction,
    type Router
} from "express";

import {
    createNotificationRepository,
    type DatabaseClient,
    type NotificationRecord
} from "../modules/notifications/notificationRepository";

// Authenticated user information.
interface AuthenticatedUser {
    user_id?: string | number;
    id?: string | number;
}

interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}

// Authentication middleware type.
type RequireAuth = (
    req: Request,
    res: Response,
    next: NextFunction
) => void;

// Route configuration.
interface CreateNotificationRoutesOptions {
    db: DatabaseClient;
    requireAuth: RequireAuth;
}

// Frontend notification format.
interface AppNotification {
    id: string;
    goalId: string | null;
    type: string;
    message: string;
    createdAt: Date | string;
    read: boolean;
}

// Get the authenticated user's ID.
function getUserId(req: AuthenticatedRequest): string | null {
    const id = req.user?.user_id ?? req.user?.id;

    return id == null ? null : String(id);
}

// Convert database notification into frontend format.
function toAppNotification(
    row: NotificationRecord
): AppNotification {
    return {
        id: String(row.notification_id),

        goalId:
            row.related_type === "goal" && row.related_id != null
                ? String(row.related_id)
                : null,

        type: row.notification_type,
        message: row.message,
        createdAt: row.created_at,
        read: row.is_read
    };
}

// Mount at /api/notifications using the existing database pool and auth middleware.
export function createNotificationRoutes({
    db,
    requireAuth
}: CreateNotificationRoutesOptions): Router {

    if (!db || !requireAuth) {
        throw new Error("db and requireAuth are required.");
    }

    const router = express.Router();

    const repository = createNotificationRepository(db);

    router.use(requireAuth);

    // GET /api/notifications?unread=true
    // Without unread=true, returns notification history.
    router.get(
        "/",
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const userId = getUserId(
                    req as AuthenticatedRequest
                );

                if (!userId) {
                    return res.status(401).json({
                        message: "Authentication required."
                    });
                }

                const limitValue = Number.parseInt(
                    String(req.query.limit ?? ""),
                    10
                );

                const offsetValue = Number.parseInt(
                    String(req.query.offset ?? ""),
                    10
                );

                const limit = Math.min(
                    Math.max(
                        Number.isNaN(limitValue) ? 50 : limitValue,
                        1
                    ),
                    100
                );

                const offset = Math.max(
                    Number.isNaN(offsetValue) ? 0 : offsetValue,
                    0
                );

                const unreadOnly = req.query.unread === "true";

                const rows = unreadOnly
                    ? await repository.getUnread(userId, limit, offset)
                    : await repository.getHistory(userId, limit, offset);

                return res.json({
                    notifications: rows.map(toAppNotification)
                });

            } catch (error) {
                return next(error);
            }
        }
    );

    // GET /api/notifications/unread-count
    router.get(
        "/unread-count",
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const userId = getUserId(
                    req as AuthenticatedRequest
                );

                if (!userId) {
                    return res.status(401).json({
                        message: "Authentication required."
                    });
                }

                const unreadCount =
                    await repository.getUnreadCount(userId);

                return res.json({ unreadCount });

            } catch (error) {
                return next(error);
            }
        }
    );

    // GET /api/notifications/:id
    router.get(
        "/:id",
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const userId = getUserId(
                    req as AuthenticatedRequest
                );

                if (!userId) {
                    return res.status(401).json({
                        message: "Authentication required."
                    });
                }

                const row = await repository.getDetails(
                    userId,
                    req.params.id
                );

                if (!row) {
                    return res.status(404).json({
                        message: "Notification not found."
                    });
                }

                return res.json({
                    notification: toAppNotification(row)
                });

            } catch (error) {
                return next(error);
            }
        }
    );

    // POST /api/notifications/:id/read
    router.post(
        "/:id/read",
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const userId = getUserId(
                    req as AuthenticatedRequest
                );

                if (!userId) {
                    return res.status(401).json({
                        message: "Authentication required."
                    });
                }

                const row = await repository.markAsRead(
                    userId,
                    req.params.id
                );

                if (!row) {
                    return res.status(404).json({
                        message: "Notification not found."
                    });
                }

                return res.json({
                    notification: toAppNotification(row)
                });

            } catch (error) {
                return next(error);
            }
        }
    );

    return router;
}
