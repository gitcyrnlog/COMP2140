import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import type { ErrorRequestHandler } from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pg from "pg";
import argon2 from "argon2";
import { z } from "zod";
import { runMigrations } from "./db/migrate.js";
import { createAuthRouter } from "./auth/authRoutes.js";
import { createGoalsRouter } from "./goals/goalRoutes.js";
import { startGoalAlertScheduler } from "./goals/goalAlerts.js";
import { createNotificationsRouter } from "./utility/notifications.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing.");
}

const pool = new pg.Pool({
    connectionString: databaseUrl,
    max:10,
    connectionTimeoutMillis:5000,
});

pool.on("error", () => {
    console.error("Unexpected database connection error.");
});

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));

const registrationSchema = z.object({
    name: z.string().trim().min(1).max(80),
    email:z.string().trim().toLowerCase().email().max(254),
    password:z.string().min(15).max(128),
}).strict();

const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        message: "Too many registration attempts. Try again later.",
    },
});

app.post("/api/auth/register", registrationLimiter, async (req,res) => {
    const parsed = registrationSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({
            message:
            "Enter a name, a valid email, and a password of 15-128 characters.",
        });
        return;
    }
    const { name, email, password } = parsed.data;

    try {
        const passwordHash = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 19456,
            timeCost: 2,
            parallelism: 1,
        });
        
        const result = await pool.query(
            `INSERT INTO users (id, name, email, password_hash)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ON CONSTRAINT users_email_unique DO NOTHING
            RETURNING id, name, email, created_at`,
            [randomUUID(), name, email, passwordHash],
        );
        if (result.rows.length === 0) {
            res.status(409).json({
                message: "An account with this email already exists",
            });
            return;
        }

        res.status(201).json({
            message:"Account created successfully.",

            user:result.rows[0],
        });
    }catch{
        console.error("Registration failed.");

        res.status(500).json({
            message: "Unable to create your account. Please try again.",
        });
    }
});

// Login / logout / current user (Authentication)
app.use(createAuthRouter(pool));
// FR1 Goal Management
app.use(createGoalsRouter(pool));
// FR4 Notification history (goal alerts are stored here)
app.use(createNotificationsRouter(pool));

const errorHandler: ErrorRequestHandler = (error, _req,res,_next) => {
    if (error?.type === "entity.too.large") {
        res.status(413).json({message: "Invalid JSON request"});
        return;
    }

    if (error?.type === "entity.parse.failed") {
        res.status(400).json({ message: "Invalid JSON request." });
        return;
    }

    console.error("Unexpected API error.");
    res.status(500).json({ message: "Something went wrong. "});
};

const clientDist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../dist",
);
app.use(express.static(clientDist));

app.use(errorHandler);

async function start() {
    await pool.query("SELECT 1");
    await runMigrations(pool);
    startGoalAlertScheduler(pool);

    const port = Number(process.env.PORT ?? 3001);

    app.listen(port, "0.0.0.0", () => {
        console.log(`ClearSpend API running on port ${port}`);
    });
}

start().catch((error: unknown) => {
    console.error("API startup failed:", error);
    process.exit(1);
});