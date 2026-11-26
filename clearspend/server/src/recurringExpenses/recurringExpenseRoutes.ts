
import { Router } from "express";
import type pg from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAuth, userIdOf } from "../auth/session.js";
import { todayInJamaica } from "../utility/dates.js";

const expenseSchema = z.object({
    name: z.string().trim().min(1).max(100),
    amountCents: z.number().int().positive().max(2147483647),
    category: z.string().trim().min(1).max(80),
    frequency: z.enum(["weekly", "monthly"]),
    nextDate: z.string().date(),
}).strict();

export async function initializeRecurringExpenses(pool: pg.Pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS recurring_expenses (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
            category VARCHAR(80) NOT NULL,
            frequency VARCHAR(10) NOT NULL
                CHECK (frequency IN ('weekly', 'monthly')),
            next_date DATE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS recurring_expense_records (
            id UUID PRIMARY KEY,
            recurring_expense_id UUID NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            amount_cents INTEGER NOT NULL,
            category VARCHAR(80) NOT NULL,
            expense_date DATE NOT NULL,
            UNIQUE (recurring_expense_id, expense_date)
        );
    `);
}

export function createRecurringExpensesRouter(pool: pg.Pool) {
    const router = Router();

    router.use("/api/recurring-expenses", requireAuth(pool));

    router.get("/api/recurring-expenses", async (_req, res, next) => {
        try {
            const result = await pool.query(
                `SELECT id, name, amount_cents, category, frequency,
                        next_date::text AS next_date
                 FROM recurring_expenses
                 WHERE user_id = $1
                 ORDER BY next_date`,
                [userIdOf(res)]
            );

            res.json(result.rows);
        } catch (error) {
            next(error);
        }
    });

    router.get("/api/recurring-expenses/history", async (_req, res, next) => {
        try {
            const result = await pool.query(
                `SELECT id, name, amount_cents, category,
                        expense_date::text AS expense_date
                 FROM recurring_expense_records
                 WHERE user_id = $1
                 ORDER BY expense_date DESC`,
                [userIdOf(res)]
            );

            res.json(result.rows);
        } catch (error) {
            next(error);
        }
    });

    router.post("/api/recurring-expenses", async (req, res, next) => {
        const parsed = expenseSchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({
                message: "Enter valid recurring expense details."
            });
            return;
        }

        const expense = parsed.data;

        try {
            const result = await pool.query(
                `INSERT INTO recurring_expenses
                 (id, user_id, name, amount_cents, category, frequency, next_date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [
                    randomUUID(),
                    userIdOf(res),
                    expense.name,
                    expense.amountCents,
                    expense.category,
                    expense.frequency,
                    expense.nextDate
                ]
            );

            res.status(201).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    });

    router.put("/api/recurring-expenses/:id", async (req, res, next) => {
        const parsed = expenseSchema.safeParse(req.body);

        if (!parsed.success || !z.string().uuid().safeParse(req.params.id).success) {
            res.status(400).json({
                message: "Enter valid recurring expense details."
            });
            return;
        }

        const expense = parsed.data;

        try {
            const result = await pool.query(
                `UPDATE recurring_expenses
                 SET name = $1, amount_cents = $2, category = $3,
                     frequency = $4, next_date = $5
                 WHERE id = $6 AND user_id = $7
                 RETURNING id`,
                [
                    expense.name,
                    expense.amountCents,
                    expense.category,
                    expense.frequency,
                    expense.nextDate,
                    req.params.id,
                    userIdOf(res)
                ]
            );

            if (result.rowCount === 0) {
                res.status(404).json({ message: "Expense not found." });
                return;
            }

            res.json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    });

    router.delete("/api/recurring-expenses/:id", async (req, res, next) => {
        if (!z.string().uuid().safeParse(req.params.id).success) {
            res.status(400).json({ message: "Invalid expense ID." });
            return;
        }

        try {
            const result = await pool.query(
                `DELETE FROM recurring_expenses
                 WHERE id = $1 AND user_id = $2`,
                [req.params.id, userIdOf(res)]
            );

            if (result.rowCount === 0) {
                res.status(404).json({ message: "Expense not found." });
                return;
            }

            res.status(204).end();
        } catch (error) {
            next(error);
        }
    });

    return router;
}

export function startRecurringExpenseScheduler(pool: pg.Pool) {
    let running = false;

    async function processExpenses() {
        if (running) return;
        running = true;

        try {
            const today = todayInJamaica().slice(0, 10);

            const result = await pool.query(
                `SELECT id FROM recurring_expenses
                 WHERE next_date <= $1`,
                [today]
            );

            for (const expense of result.rows) {
                const client = await pool.connect();

                try {
                    await client.query("BEGIN");

                    const locked = await client.query(
                        `SELECT * FROM recurring_expenses
                         WHERE id = $1 AND next_date <= $2
                         FOR UPDATE`,
                        [expense.id, today]
                    );

                    if (locked.rows.length > 0) {
                        await client.query(
                            `INSERT INTO recurring_expense_records
                             (id, recurring_expense_id, user_id, name,
                              amount_cents, category, expense_date)
                             SELECT $1, id, user_id, name,
                                    amount_cents, category, next_date
                             FROM recurring_expenses WHERE id = $2
                             ON CONFLICT (recurring_expense_id, expense_date)
                             DO NOTHING`,
                            [randomUUID(), expense.id]
                        );

                        await client.query(
                            `UPDATE recurring_expenses
                             SET next_date = CASE
                                 WHEN frequency = 'weekly'
                                 THEN next_date + 7
                                 ELSE (next_date + INTERVAL '1 month')::date
                             END
                             WHERE id = $1`,
                            [expense.id]
                        );
                    }

                    await client.query("COMMIT");
                } catch (error) {
                    await client.query("ROLLBACK");
                    console.error("Recurring expense processing failed.", error);
                } finally {
                    client.release();
                }
            }
        } catch (error) {
            console.error("Recurring expense scheduler failed.", error);
        } finally {
            running = false;
        }
    }

    void processExpenses();

    setInterval(() => {
        void processExpenses();
    }, 60000);
}
