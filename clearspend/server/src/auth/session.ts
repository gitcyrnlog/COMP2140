// Utility Services: User Authentication / session handling.
// Sessions are random tokens in an httpOnly cookie; only a SHA-256 hash is stored in the database.
// A session expires after 15 minutes of inactivity (SRS 3.2).
import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type pg from "pg";

export const SESSION_COOKIE = "cs_session";
export const IDLE_TIMEOUT_MINUTES = 15;

function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export function readCookie(req: Request, name: string): string | null {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(";")) {
        const [key, ...rest] = part.trim().split("=");
        if (key === name) return decodeURIComponent(rest.join("="));
    }
    return null;
}

export async function createSession(pool: pg.Pool, userId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await pool.query(`INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)`, [hashToken(token), userId]);
    return token;
}

export async function destroySession(pool: pg.Pool, token: string): Promise<void> {
    await pool.query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
}

export function setSessionCookie(res: Response, token: string): void {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${secure}`);
}

export function clearSessionCookie(res: Response): void {
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

/** Resolves the logged-in user from the cookie and refreshes the idle timer. Responds 401 otherwise. */
export function requireAuth(pool: pg.Pool): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const token = readCookie(req, SESSION_COOKIE);
            if (!token) {
                res.status(401).json({ message: "Please log in to continue." });
                return;
            }
            const result = await pool.query<{ user_id: string }>(
                `UPDATE sessions SET last_seen_at = now()
                 WHERE token_hash = $1 AND last_seen_at > now() - make_interval(mins => $2)
                 RETURNING user_id`,
                [hashToken(token), IDLE_TIMEOUT_MINUTES],
            );
            if (result.rows.length === 0) {
                await pool.query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
                clearSessionCookie(res);
                res.status(401).json({ message: "Your session has expired. Please log in again." });
                return;
            }
            res.locals.userId = result.rows[0]!.user_id;
            next();
        } catch (error) {
            next(error);
        }
    };
}

export function userIdOf(res: Response): string {
    return res.locals.userId as string;
}
