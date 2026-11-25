import { Router } from "express";
import type { ErrorRequestHandler } from "express";
import type pg from "pg";
import { requireAuth, userIdOf } from "../auth/session.js";
import { todayInJamaica } from "../utility/dates.js";
import { fieldErrors } from "../goals/goalSchemas.js";
import { budgetInputSchema, monthSchema } from "./budgetSchemas.js";
import { BudgetError, createBudgetService } from "./budgetService.js";
import type { SpendingSource } from "./budgetSpending.js";

export function createBudgetsRouter(pool: pg.Pool, options: { spendingSource?: SpendingSource } = {}) {
    const router = Router();
    const service = createBudgetService(pool, options.spendingSource);
    router.use("/api/budgets", requireAuth(pool));

    router.get("/api/budgets", async (req, res, next) => {
        const parsed = monthSchema.safeParse(req.query.month ?? todayInJamaica().slice(0, 7));
        if (!parsed.success) {
            res.status(400).json({ message: "Choose a valid month." });
            return;
        }
        try {
            res.json(await service.list(userIdOf(res), parsed.data));
        } catch (error) { next(error); }
    });

    router.post("/api/budgets", async (req, res, next) => {
        const parsed = budgetInputSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json(fieldErrors(parsed.error));
            return;
        }
        try {
            res.status(201).json(await service.create(userIdOf(res), parsed.data));
        } catch (error) { next(error); }
    });

    router.use("/api/budgets/:id", (req, res, next) => {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.params.id))) {
            res.status(404).json({ message: "Budget not found." });
            return;
        }
        next();
    });

    router.put("/api/budgets/:id", async (req, res, next) => {
        const parsed = budgetInputSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json(fieldErrors(parsed.error));
            return;
        }
        try {
            res.json(await service.update(userIdOf(res), String(req.params.id), parsed.data));
        } catch (error) { next(error); }
    });

    router.delete("/api/budgets/:id", async (req, res, next) => {
        try {
            await service.delete(userIdOf(res), String(req.params.id));
            res.status(204).end();
        } catch (error) { next(error); }
    });

    const handleError: ErrorRequestHandler = (error, _req, res, next) => {
        if (error instanceof BudgetError) {
            res.status(error.status).json({ message: error.message });
            return;
        }
        next(error);
    };
    router.use("/api/budgets", handleError);
    return router;
}
