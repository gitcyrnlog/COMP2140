import { randomUUID } from "node:crypto";
import type pg from "pg";
import { dollarsToCents, formatJmd } from "../utility/financialCalc.js";
import { createNotification } from "../utility/notifications.js";
import * as repository from "./budgetRepository.js";
import type { BudgetInput } from "./budgetSchemas.js";
import { totalForCategory, unavailableSpending, usageFor } from "./budgetSpending.js";
import type { SpendingSource } from "./budgetSpending.js";

export class BudgetError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export function createBudgetService(pool: pg.Pool, spendingSource: SpendingSource = unavailableSpending) {
    async function transaction<T>(userId: string, work: (db: pg.PoolClient) => Promise<T>): Promise<T> {
        const db = await pool.connect();
        try {
            await db.query("BEGIN");
            // Serialize budget operations for one account, including alert checks.
            await db.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
            const result = await work(db);
            await db.query("COMMIT");
            return result;
        } catch (error) {
            await db.query("ROLLBACK");
            if (error && typeof error === "object" && "code" in error && error.code === "23505") {
                throw new BudgetError(409, "This category already has a budget for that month. Edit the existing budget.");
            }
            throw error;
        } finally {
            db.release();
        }
    }

    async function snapshot(db: pg.PoolClient, userId: string, month: string) {
        const rows = await repository.listBudgets(db, userId, month);
        const spending = await spendingSource(db, userId, month);
        const budgets = [];
        for (const row of rows) {
            const usage = spending === null ? null : usageFor(totalForCategory(spending, row.category), row.limitCents);
            if (usage) {
                const level = usage.status === "reached" ? 2 : usage.status === "near" ? 1 : 0;
                if (level > row.alertLevel) {
                    await createNotification(db, {
                        userId, goalId: null, type: level === 2 ? "budget_limit_reached" : "budget_near_limit",
                        message: `${row.category} (${month}): ${level === 2 ? "reached" : "used at least 80% of"} the ${formatJmd(row.limitCents)} spending limit.`,
                    });
                }
                if (level !== row.alertLevel) await repository.setAlertLevel(db, userId, row.id, level);
            }
            budgets.push({
                id: row.id, category: row.category, month: row.month, limit: row.limitCents / 100,
                spent: usage?.spent ?? null, remaining: usage?.remaining ?? null,
                percentUsed: usage?.percentUsed ?? null, status: usage?.status ?? "unavailable",
            });
        }
        return { budgets, spendingAvailable: spending !== null };
    }

    return {
        list: (userId: string, month: string) => transaction(userId, db => snapshot(db, userId, month)),
        create: (userId: string, input: BudgetInput) => transaction(userId, async db => {
            const id = randomUUID();
            await repository.insertBudget(db, { ...input, id, userId, limitCents: dollarsToCents(input.limit) });
            return snapshot(db, userId, input.month);
        }),
        update: (userId: string, id: string, input: BudgetInput) => transaction(userId, async db => {
            const found = await repository.updateBudget(db, userId, id, { ...input, limitCents: dollarsToCents(input.limit) });
            if (!found) throw new BudgetError(404, "Budget not found.");
            return snapshot(db, userId, input.month);
        }),
        delete: (userId: string, id: string) => transaction(userId, async db => {
            if (!await repository.deleteBudget(db, userId, id)) throw new BudgetError(404, "Budget not found.");
        }),
    };
}
