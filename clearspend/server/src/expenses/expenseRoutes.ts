import { randomUUID } from "node:crypto";
import { Router } from "express";
import type pg from "pg";
import { z } from "zod";
import { requireAuth, userIdOf } from "../auth/session.js";

const expenseSchema = z
    .object({
        amountCents: z.number().int().positive().max(2147483647),
        category: z.string().trim().min(1).max(80),
        expenseDate: z.string().date(),
        description: z.string().trim().min(1).max(240),
    })
    .strict();

const expenseColumns = `
    id,
    amount_cents AS "amountCents",
    category,
    to_char(expense_date, 'YYYY-MM-DD') AS "expenseDate",
    description,
    created_at AS "createdAt"
`;

export function createExpensesRouter(pool: pg.Pool) {
    const router = Router();

    router.use("/api/expenses", requireAuth(pool));

    router.get("/api/expenses", async (_req, res, next) => {
        try {
            const result = await pool.query(
                `SELECT ${expenseColumns}
                 FROM expenses
                 WHERE user_id = $1
                 ORDER BY expense_date DESC, created_at DESC`,
                [userIdOf(res)],
            );

            res.json({ expenses: result.rows });
        } catch (error) {
            next(error);
        }
    });

    router.post("/api/expenses", async (req, res, next) => {
        const parsed = expenseSchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({
                message: "Enter a valid amount, category, date, and description.",
            });
            return;
        }

        try {
            const expense = parsed.data;
            const result = await pool.query(
                `INSERT INTO expenses
                    (id, user_id, amount_cents, category, expense_date, description)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING ${expenseColumns}`,
                [
                    randomUUID(),
                    userIdOf(res),
                    expense.amountCents,
                    expense.category,
                    expense.expenseDate,
                    expense.description,
                ],
            );

            res.status(201).json({ expense: result.rows[0] });
        } catch (error) {
            next(error);
        }
    });

    router.put("/api/expenses/:id", async (req, res, next) => {
        const parsed = expenseSchema.safeParse(req.body);
        const id = z.string().uuid().safeParse(req.params.id);

        if (!parsed.success || !id.success) {
            res.status(400).json({
                message: "Enter a valid amount, category, date, and description.",
            });
            return;
        }

        try {
            const expense = parsed.data;
            const result = await pool.query(
                `UPDATE expenses
                 SET amount_cents = $1,
                     category = $2,
                     expense_date = $3,
                     description = $4,
                     updated_at = now()
                 WHERE id = $5 AND user_id = $6
                 RETURNING ${expenseColumns}`,
                [
                    expense.amountCents,
                    expense.category,
                    expense.expenseDate,
                    expense.description,
                    id.data,
                    userIdOf(res),
                ],
            );

            if (result.rowCount === 0) {
                res.status(404).json({ message: "Expense not found." });
                return;
            }

            res.json({ expense: result.rows[0] });
        } catch (error) {
            next(error);
        }
    });

    router.delete("/api/expenses/:id", async (req, res, next) => {
        const id = z.string().uuid().safeParse(req.params.id);

        if (!id.success) {
            res.status(400).json({ message: "Invalid expense ID." });
            return;
        }

        try {
            const result = await pool.query(
                `DELETE FROM expenses
                 WHERE id = $1 AND user_id = $2`,
                [id.data, userIdOf(res)],
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