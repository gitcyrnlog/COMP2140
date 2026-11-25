// Login / logout / current user. Registration lives in src/index.ts (POST /api/auth/register).
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import argon2 from "argon2";
import type pg from "pg";
import { z } from "zod";
import {
    clearSessionCookie,
    createSession,
    destroySession,
    readCookie,
    requireAuth,
    SESSION_COOKIE,
    setSessionCookie,
    userIdOf,
} from "./session.js";

const loginSchema = z
    .object({
        email: z.string().trim().toLowerCase().email().max(254),
        password: z.string().min(1).max(128),
    })
    .strict();

export function createAuthRouter(pool: pg.Pool, options: { limit?: number } = {}): Router {
    const router = Router();

    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: options.limit ?? 20,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { message: "Too many login attempts. Try again later." },
    });

    router.post("/api/auth/login", loginLimiter, async (req, res, next) => {
        try {
            const parsed = loginSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ message: "Enter your email and password." });
                return;
            }
            const { email, password } = parsed.data;
            const found = await pool.query<{ id: string; name: string; email: string; password_hash: string }>(
                `SELECT id, name, email, password_hash FROM users WHERE email = $1`,
                [email],
            );
            const user = found.rows[0];
            const valid = user ? await argon2.verify(user.password_hash, password).catch(() => false) : false;
            if (!user || !valid) {
                res.status(401).json({ message: "Invalid email or password." });
                return;
            }
            const token = await createSession(pool, user.id);
            setSessionCookie(res, token);
            res.json({ user: { id: user.id, name: user.name, email: user.email } });
        } catch (error) {
            next(error);
        }
    });

    router.post("/api/auth/logout", async (req, res, next) => {
        try {
            const token = readCookie(req, SESSION_COOKIE);
            if (token) await destroySession(pool, token);
            clearSessionCookie(res);
            res.status(204).end();
        } catch (error) {
            next(error);
        }
    });

    router.get("/api/auth/me", requireAuth(pool), async (_req, res, next) => {
        try {
            const result = await pool.query(`SELECT id, name, email FROM users WHERE id = $1`, [userIdOf(res)]);
            if (result.rows.length === 0) {
                res.status(401).json({ message: "Please log in to continue." });
                return;
            }
            res.json({ user: result.rows[0] });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
