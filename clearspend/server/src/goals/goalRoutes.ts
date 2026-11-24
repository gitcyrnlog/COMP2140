// Controller for FR1 Goal Management: HTTP routes under /api/goals (all require a logged-in user).
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import type pg from "pg";
import { requireAuth, userIdOf } from "../auth/session.js";
import { todayInJamaica } from "../utility/dates.js";
import { contributionSchema, createGoalSchema, fieldErrors, SORT_FIELDS, updateGoalSchema } from "./goalSchemas.js";
import type { SortField, SortOrder } from "./goalSchemas.js";
import { createGoalsService, GoalError } from "./goalService.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createGoalsRouter(pool: pg.Pool, options: { today?: () => string } = {}): Router {
    const router = Router();
    const service = createGoalsService({ pool, today: options.today ?? (() => todayInJamaica()) });

    router.use("/api/goals", requireAuth(pool));

    router.get("/api/goals", async (req, res, next) => {
        try {
            const sortParam = typeof req.query.sort === "string" ? req.query.sort : "targetDate";
            if (!(SORT_FIELDS as readonly string[]).includes(sortParam)) {
                res.status(400).json({ message: "Sort by priority, targetDate or targetAmount." });
                return;
            }
            const orderParam = typeof req.query.order === "string" ? req.query.order : undefined;
            if (orderParam !== undefined && orderParam !== "asc" && orderParam !== "desc") {
                res.status(400).json({ message: "Order must be asc or desc." });
                return;
            }
            const goals = await service.listGoals(userIdOf(res), sortParam as SortField, orderParam as SortOrder | undefined);
            res.json({ goals });
        } catch (error) {
            next(error);
        }
    });

    router.post("/api/goals", async (req, res, next) => {
        try {
            const parsed = createGoalSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json(fieldErrors(parsed.error));
                return;
            }
            const goal = await service.createGoal(userIdOf(res), parsed.data);
            res.status(201).json({ goal });
        } catch (error) {
            next(error);
        }
    });

    router.patch("/api/goals/:id", withGoalId(async (req, res, id) => {
        const parsed = updateGoalSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json(fieldErrors(parsed.error));
            return;
        }
        res.json(await service.updateGoal(userIdOf(res), id, parsed.data));
    }));

    router.delete("/api/goals/:id", withGoalId(async (req, res, id) => {
        await service.deleteGoal(userIdOf(res), id, req.query.confirm === "true");
        res.status(204).end();
    }));

    router.post("/api/goals/:id/contributions", withGoalId(async (req, res, id) => {
        const parsed = contributionSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json(fieldErrors(parsed.error));
            return;
        }
        res.status(201).json(await service.addContribution(userIdOf(res), id, parsed.data.amount));
    }));

    // Maps GoalError to a JSON response; anything else goes to the app's error handler.
    router.use("/api/goals", (error: unknown, _req: Request, res: Response, next: NextFunction) => {
        if (error instanceof GoalError) {
            res.status(error.status).json({ message: error.message, ...error.extra });
            return;
        }
        next(error);
    });

    return router;
}

function withGoalId(handler: (req: Request, res: Response, id: string) => Promise<void>) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = String(req.params.id);
            if (!UUID.test(id)) {
                res.status(404).json({ message: "Goal not found." });
                return;
            }
            await handler(req, res, id);
        } catch (error) {
            next(error);
        }
    };
}
