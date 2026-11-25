import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import express from "express";
import pg from "pg";
import { createSession } from "../auth/session.js";
import { runMigrations } from "../db/migrate.js";
import { budgetInputSchema, monthSchema } from "./budgetSchemas.js";
import { totalForCategory, usageFor } from "./budgetSpending.js";
import { createBudgetsRouter } from "./budgetRoutes.js";

describe("FR3 validation and calculations", () => {
    it("accepts two-decimal money and trims categories", () => {
        assert.deepEqual(budgetInputSchema.parse({ category: " Food ", month: "2026-11", limit: 0.29 }),
            { category: "Food", month: "2026-11", limit: 0.29 });
    });
    it("rejects invalid limits, months, categories and unexpected fields", () => {
        const input = { category: "Food", month: "2026-11", limit: 1000 };
        for (const limit of [0, -1, 1.001, Infinity, NaN, 1e10]) {
            assert.equal(budgetInputSchema.safeParse({ ...input, limit }).success, false);
        }
        for (const month of ["2026-00", "2026-13", "26-01", "2026-01-01", "0000-01"]) {
            assert.equal(monthSchema.safeParse(month).success, false);
        }
        assert.equal(budgetInputSchema.safeParse({ ...input, category: "  " }).success, false);
        assert.equal(budgetInputSchema.safeParse({ ...input, spent: 100 }).success, false);
    });
    it("matches normalized categories and combines whole-cent totals", () => {
        assert.equal(totalForCategory([
            { category: " food ", amountCents: 29 }, { category: "FOOD", amountCents: 71 },
            { category: "Transport", amountCents: 500 },
        ], "Food"), 100);
    });
    it("rejects invalid or unsafe expense totals", () => {
        for (const amountCents of [-1, 0.5, Infinity]) {
            assert.throws(() => totalForCategory([{ category: "Food", amountCents }], "Food"));
        }
        assert.throws(() => totalForCategory([
            { category: "Food", amountCents: Number.MAX_SAFE_INTEGER }, { category: "Food", amountCents: 1 },
        ], "Food"));
    });
    it("checks exact warning boundaries and reports overspending", () => {
        assert.equal(usageFor(7999, 10000).status, "within");
        assert.equal(usageFor(8000, 10000).status, "near");
        assert.equal(usageFor(9999, 10000).percentUsed, 99.9);
        assert.deepEqual(usageFor(11000, 10000), { spent: 110, remaining: -10, percentUsed: 110, status: "reached" });
    });
});

describe("FR3 budget API", { skip: !process.env.TEST_DATABASE_URL && "Set TEST_DATABASE_URL to run PostgreSQL integration tests." }, () => {
    let pool: pg.Pool;
    let server: Server;
    let base = "";
    let userId = "";
    let otherId = "";
    let cookie = "";
    let otherCookie = "";
    let spending: { category: string; amountCents: number }[] | null = null;

    async function call(method: string, path: string, body?: unknown, who = cookie) {
        const response = await fetch(base + path, {
            method, headers: { "Content-Type": "application/json", Cookie: who },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        return { status: response.status, body: response.status === 204 ? null : await response.json() };
    }
    const create = (extra = {}) => call("POST", "/api/budgets", { category: "Food", month: "2026-11", limit: 100, ...extra });
    const list = () => call("GET", "/api/budgets?month=2026-11");

    before(async () => {
        pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
        await runMigrations(pool);
        // Re-running the additive schema must preserve existing tables.
        await runMigrations(pool);
        const app = express();
        app.use(express.json());
        app.use(createBudgetsRouter(pool, { spendingSource: async () => spending }));
        server = app.listen(0, "127.0.0.1");
        await new Promise<void>(resolve => server.once("listening", resolve));
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    beforeEach(async () => {
        if (userId) await pool.query("DELETE FROM users WHERE id IN ($1, $2)", [userId, otherId]);
        userId = randomUUID();
        otherId = randomUUID();
        for (const id of [userId, otherId]) {
            await pool.query("INSERT INTO users (id, name, email, password_hash) VALUES ($1, 'Budget test', $2, 'x')", [id, `${id}@test.local`]);
        }
        cookie = `cs_session=${await createSession(pool, userId)}`;
        otherCookie = `cs_session=${await createSession(pool, otherId)}`;
        spending = null;
    });
    after(async () => {
        if (userId) await pool.query("DELETE FROM users WHERE id IN ($1, $2)", [userId, otherId]);
        if (server) await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
        if (pool) await pool.end();
    });

    it("requires a session and validates requests", async () => {
        assert.equal((await call("GET", "/api/budgets", undefined, "")).status, 401);
        assert.equal((await call("GET", "/api/budgets?month=2026-13")).status, 400);
        assert.equal((await create({ limit: -1 })).status, 400);
        assert.equal((await call("DELETE", "/api/budgets/invalid")).status, 404);
    });
    it("persists limits and leaves spending unavailable until FR2 is connected", async () => {
        const result = await create();
        assert.equal(result.status, 201);
        assert.equal(result.body.spendingAvailable, false);
        const budget = (await list()).body.budgets[0];
        assert.equal(budget.limit, 100);
        assert.equal(budget.spent, null);
        assert.equal(budget.remaining, null);
        assert.equal(budget.status, "unavailable");
    });
    it("prevents duplicate category limits per month, including concurrent requests", async () => {
        const results = await Promise.all([create(), create({ category: " food " })]);
        assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
        assert.equal((await list()).body.budgets.length, 1);
        assert.equal((await create({ month: "2026-12" })).status, 201);
    });
    it("updates and deletes owned budgets and hides them from other accounts", async () => {
        const budget = (await create()).body.budgets[0];
        assert.deepEqual((await call("GET", "/api/budgets?month=2026-11", undefined, otherCookie)).body.budgets, []);
        const input = { category: "Food", month: "2026-11", limit: 200 };
        assert.equal((await call("PUT", `/api/budgets/${budget.id}`, input, otherCookie)).status, 404);
        assert.equal((await call("DELETE", `/api/budgets/${budget.id}`, undefined, otherCookie)).status, 404);
        assert.equal((await call("PUT", `/api/budgets/${budget.id}`, input)).body.budgets[0].limit, 200);
        assert.equal((await call("DELETE", `/api/budgets/${budget.id}`)).status, 204);
        assert.deepEqual((await list()).body.budgets, []);
    });
    it("rolls back a conflicting edit", async () => {
        const food = (await create()).body.budgets[0];
        await create({ category: "Transport" });
        assert.equal((await call("PUT", `/api/budgets/${food.id}`, { category: "Transport", month: "2026-11", limit: 20 })).status, 409);
        assert.equal((await list()).body.budgets.find((item: { id: string }) => item.id === food.id).limit, 100);
    });
    it("refreshes spending, stores alerts once, and rearms after recovery", async () => {
        await create();
        spending = [{ category: "food", amountCents: 8000 }];
        await Promise.all([list(), list()]);
        let history = await pool.query("SELECT type FROM notifications WHERE user_id = $1", [userId]);
        assert.deepEqual(history.rows.map(row => row.type), ["budget_near_limit"]);
        spending = [{ category: "Food", amountCents: 11000 }];
        const budget = (await list()).body.budgets[0];
        assert.equal(budget.remaining, -10);
        await list();
        history = await pool.query("SELECT type FROM notifications WHERE user_id = $1", [userId]);
        assert.equal(history.rows.length, 2);
        spending = [];
        await list();
        spending = [{ category: "Food", amountCents: 8000 }];
        await list();
        history = await pool.query("SELECT type FROM notifications WHERE user_id = $1", [userId]);
        assert.equal(history.rows.length, 3);
    });
    it("re-evaluates usage when a limit is lowered", async () => {
        spending = [{ category: "Food", amountCents: 5000 }];
        const budget = (await create()).body.budgets[0];
        const result = await call("PUT", `/api/budgets/${budget.id}`, { category: "Food", month: "2026-11", limit: 40 });
        assert.equal(result.body.budgets[0].status, "reached");
        assert.equal(result.body.budgets[0].remaining, -10);
    });
});
