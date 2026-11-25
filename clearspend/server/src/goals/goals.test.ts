// Acceptance tests for FR1 Goal Management. Each test is named after the SRS scenario it checks.
// Requires a PostgreSQL database: TEST_DATABASE_URL=postgres://user:pass@localhost:5432/clearspend_test
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import express from "express";
import pg from "pg";
import { createSession } from "../auth/session.js";
import { runMigrations } from "../db/migrate.js";
import { createNotificationsRouter } from "../utility/notifications.js";
import { createGoalsRouter } from "./goalRoutes.js";

const url = process.env.TEST_DATABASE_URL;

describe("FR1 Goal Management (API)", { skip: url ? false : "set TEST_DATABASE_URL to run database tests" }, () => {
    let pool: pg.Pool;
    let server: Server;
    let base = "";
    let clock = "2026-11-01";
    let cookie = "";
    let otherCookie = "";

    async function makeUser(): Promise<string> {
        const id = randomUUID();
        await pool.query(`INSERT INTO users (id, name, email, password_hash) VALUES ($1, 'Test', $2, 'x')`, [id, `${id}@test.local`]);
        return `cs_session=${await createSession(pool, id)}`;
    }

    async function call(method: string, path: string, body?: unknown, who = cookie) {
        const res = await fetch(base + path, {
            method,
            headers: { "Content-Type": "application/json", ...(who ? { Cookie: who } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        return { status: res.status, body: text ? JSON.parse(text) : null };
    }

    const createLaptop = (extra: Record<string, unknown> = {}) =>
        call("POST", "/api/goals", { name: "Laptop Fund", targetAmount: 80000, targetDate: "2026-12-01", ...extra });

    before(async () => {
        pool = new pg.Pool({ connectionString: url });
        await runMigrations(pool);
        const app = express();
        app.use(express.json());
        app.use(createGoalsRouter(pool, { today: () => clock }));
        app.use(createNotificationsRouter(pool));
        server = app.listen(0, "127.0.0.1");
        await new Promise((r) => server.once("listening", r));
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    beforeEach(async () => {
        await pool.query(`TRUNCATE users CASCADE`);
        clock = "2026-11-01";
        cookie = await makeUser();
        otherCookie = await makeUser();
    });

    after(async () => {
        server.close();
        await pool.end();
    });

    it("requires a logged-in user", async () => {
        assert.equal((await call("GET", "/api/goals", undefined, "")).status, 401);
        assert.equal((await call("POST", "/api/goals", {}, "")).status, 401);
    });

    describe("AC-2.1 valid goal creation", () => {
        it("Scenario 1: creates 'Laptop Fund' JMD $80,000 with a future date at 0% progress", async () => {
            const created = await createLaptop();
            assert.equal(created.status, 201);
            assert.equal(created.body.goal.name, "Laptop Fund");
            assert.equal(created.body.goal.targetAmount, 80000);
            assert.equal(created.body.goal.percentComplete, 0);
            const list = await call("GET", "/api/goals");
            assert.equal(list.body.goals.length, 1);
            assert.equal(list.body.goals[0].name, "Laptop Fund");
            assert.equal(list.body.goals[0].percentComplete, 0);
        });

        it("Scenario 2: rejects a target of JMD $0.00 with a clear message and adds no goal", async () => {
            const res = await createLaptop({ targetAmount: 0 });
            assert.equal(res.status, 400);
            assert.match(res.body.message, /greater than JMD \$0\.00/);
            assert.ok(res.body.errors.targetAmount);
            assert.equal((await call("GET", "/api/goals")).body.goals.length, 0);
        });

        it("Scenario 2: rejects a past target date, and today's date, with a clear message", async () => {
            for (const targetDate of ["2026-10-31", "2026-11-01"]) {
                const res = await createLaptop({ targetDate });
                assert.equal(res.status, 400);
                assert.match(res.body.message, /future date/);
            }
            assert.equal((await call("GET", "/api/goals")).body.goals.length, 0);
        });

        it("rejects a negative amount, a missing name and more than two decimal places", async () => {
            assert.equal((await createLaptop({ targetAmount: -5 })).status, 400);
            assert.equal((await createLaptop({ name: "   " })).status, 400);
            assert.equal((await createLaptop({ targetAmount: 100.123 })).status, 400);
            assert.equal((await createLaptop({ targetDate: "not-a-date" })).status, 400);
            assert.equal((await createLaptop({ priority: "urgent" })).status, 400);
        });
    });

    describe("AC-2.2 accurate progress tracking", () => {
        it("Scenario 3: shows 25% immediately after a JMD $20,000 contribution", async () => {
            const { body } = await createLaptop();
            const res = await call("POST", `/api/goals/${body.goal.id}/contributions`, { amount: 20000 });
            assert.equal(res.status, 201);
            assert.equal(res.body.goal.savedAmount, 20000);
            assert.equal(res.body.goal.percentComplete, 25);
            assert.equal(res.body.goal.remainingAmount, 60000);
            const list = await call("GET", "/api/goals");
            assert.equal(list.body.goals[0].savedAmount, 20000);
            assert.equal(list.body.goals[0].percentComplete, 25);
        });

        it("Scenario 4: progress stays unchanged when nothing is contributed", async () => {
            const { body } = await createLaptop();
            await call("POST", `/api/goals/${body.goal.id}/contributions`, { amount: 20000 });
            const first = (await call("GET", "/api/goals")).body.goals[0];
            const second = (await call("GET", "/api/goals")).body.goals[0];
            assert.equal(second.savedAmount, first.savedAmount);
            assert.equal(second.percentComplete, 25);
        });

        it("rejects zero and negative contributions", async () => {
            const { body } = await createLaptop();
            assert.equal((await call("POST", `/api/goals/${body.goal.id}/contributions`, { amount: 0 })).status, 400);
            assert.equal((await call("POST", `/api/goals/${body.goal.id}/contributions`, { amount: -10 })).status, 400);
        });

        it("keeps cents exact when contributions add up", async () => {
            const { body } = await createLaptop({ targetAmount: 100 });
            for (let i = 0; i < 3; i++) await call("POST", `/api/goals/${body.goal.id}/contributions`, { amount: 0.1 });
            const goal = (await call("GET", "/api/goals")).body.goals[0];
            assert.equal(goal.savedAmount, 0.3);
        });
    });

    describe("AC-2.3 timely goal notifications", () => {
        it("Scenario 5: sends a 25% alert, then a 50% alert, and never repeats a milestone", async () => {
            const { body } = await createLaptop();
            const id = body.goal.id;
            const a = await call("POST", `/api/goals/${id}/contributions`, { amount: 20000 });
            assert.deepEqual(a.body.alerts.map((n: { type: string }) => n.type), ["goal_milestone_25"]);
            const b = await call("POST", `/api/goals/${id}/contributions`, { amount: 20000 });
            assert.deepEqual(b.body.alerts.map((n: { type: string }) => n.type), ["goal_milestone_50"]);
            assert.match(b.body.alerts[0].message, /50%/);
            const c = await call("POST", `/api/goals/${id}/contributions`, { amount: 100 });
            assert.deepEqual(c.body.alerts, []);
            const history = await call("GET", "/api/notifications");
            assert.equal(history.body.notifications.length, 2);
        });

        it("sends every milestone crossed by one large contribution and a completion alert at 100%", async () => {
            const { body } = await createLaptop();
            const res = await call("POST", `/api/goals/${body.goal.id}/contributions`, { amount: 80000 });
            assert.deepEqual(
                res.body.alerts.map((n: { type: string }) => n.type),
                ["goal_milestone_25", "goal_milestone_50", "goal_milestone_75", "goal_milestone_100"],
            );
            assert.equal(res.body.goal.status, "completed");
            assert.equal(res.body.goal.percentComplete, 100);
            assert.ok(res.body.goal.completedAt);
        });

        it("Scenario 6: alerts once when a goal falls behind its required pace (5 days left, 40% saved)", async () => {
            const { body } = await createLaptop();
            await call("POST", `/api/goals/${body.goal.id}/contributions`, { amount: 32000 });
            clock = "2026-11-26";
            const list = await call("GET", "/api/goals");
            assert.equal(list.body.goals[0].status, "behind");
            assert.equal(list.body.goals[0].daysLeft, 5);
            const history = (await call("GET", "/api/notifications")).body.notifications;
            const behind = history.filter((n: { type: string }) => n.type === "goal_behind_schedule");
            assert.equal(behind.length, 1);
            assert.match(behind[0].message, /behind schedule/);
            await call("GET", "/api/goals");
            const again = (await call("GET", "/api/notifications")).body.notifications;
            assert.equal(again.filter((n: { type: string }) => n.type === "goal_behind_schedule").length, 1);
        });

        it("Scenario 7: no false alert for a goal that is on schedule or ahead of schedule", async () => {
            const { body } = await createLaptop();
            const id = body.goal.id;
            await call("POST", `/api/goals/${id}/contributions`, { amount: 40000 }); // exactly 50%
            clock = "2026-11-16"; // 15 of 30 days = 50% expected: on schedule
            let list = await call("GET", "/api/goals");
            assert.equal(list.body.goals[0].status, "on_track");
            await call("POST", `/api/goals/${id}/contributions`, { amount: 30000 }); // 87.5%
            clock = "2026-11-26";
            list = await call("GET", "/api/goals");
            assert.equal(list.body.goals[0].status, "on_track");
            const types = (await call("GET", "/api/notifications")).body.notifications.map((n: { type: string }) => n.type);
            assert.ok(!types.includes("goal_behind_schedule"));
        });

        it("a goal gets a new behind alert only after it has recovered and fallen behind again", async () => {
            const { body } = await createLaptop();
            const id = body.goal.id;
            clock = "2026-11-16";
            await call("GET", "/api/goals"); // 0% at 50% of the time: behind, alert 1
            await call("POST", `/api/goals/${id}/contributions`, { amount: 60000 }); // 75%: back on pace
            clock = "2026-11-30";
            await call("PATCH", `/api/goals/${id}`, { targetAmount: 200000, confirmDecrease: false }); // 30%: behind again
            const behind = (await call("GET", "/api/notifications")).body.notifications.filter(
                (n: { type: string }) => n.type === "goal_behind_schedule",
            );
            assert.equal(behind.length, 2);
        });
    });

    describe("AC-2.4 confirmation before changes", () => {
        it("Scenario 8: deleting needs confirmation, and deletes after the user confirms", async () => {
            const { body } = await createLaptop();
            const id = body.goal.id;
            const asked = await call("DELETE", `/api/goals/${id}`);
            assert.equal(asked.status, 409);
            assert.equal(asked.body.requiresConfirmation, true);
            assert.equal((await call("GET", "/api/goals")).body.goals.length, 1);
            const done = await call("DELETE", `/api/goals/${id}?confirm=true`);
            assert.equal(done.status, 204);
            assert.equal((await call("GET", "/api/goals")).body.goals.length, 0);
        });

        it("Scenario 9: decreasing the target needs confirmation; cancelling leaves the goal unchanged", async () => {
            const { body } = await createLaptop();
            const id = body.goal.id;
            const asked = await call("PATCH", `/api/goals/${id}`, { targetAmount: 50000 });
            assert.equal(asked.status, 409);
            assert.equal(asked.body.requiresConfirmation, true);
            assert.equal((await call("GET", "/api/goals")).body.goals[0].targetAmount, 80000);
            const confirmed = await call("PATCH", `/api/goals/${id}`, { targetAmount: 50000, confirmDecrease: true });
            assert.equal(confirmed.status, 200);
            assert.equal(confirmed.body.goal.targetAmount, 50000);
            assert.ok(confirmed.body.alerts.some((n: { type: string }) => n.type === "goal_modified"));
        });

        it("raising the target or editing the name/priority needs no confirmation", async () => {
            const { body } = await createLaptop();
            const id = body.goal.id;
            assert.equal((await call("PATCH", `/api/goals/${id}`, { targetAmount: 90000 })).status, 200);
            const renamed = await call("PATCH", `/api/goals/${id}`, { name: "Gaming Laptop", priority: "high" });
            assert.equal(renamed.body.goal.name, "Gaming Laptop");
            assert.equal(renamed.body.goal.priority, "high");
            assert.equal((await call("PATCH", `/api/goals/${id}`, {})).status, 400);
            assert.equal((await call("PATCH", `/api/goals/${id}`, { targetDate: "2026-10-01" })).status, 400);
        });

        it("a decrease below the amount saved completes the goal and sends the completion alert", async () => {
            const { body } = await createLaptop();
            const id = body.goal.id;
            await call("POST", `/api/goals/${id}/contributions`, { amount: 30000 });
            const res = await call("PATCH", `/api/goals/${id}`, { targetAmount: 30000, confirmDecrease: true });
            assert.equal(res.body.goal.status, "completed");
            assert.ok(res.body.alerts.some((n: { type: string }) => n.type === "goal_milestone_100"));
        });
    });

    describe("AC-2.5 correct goal sorting", () => {
        async function seed() {
            await call("POST", "/api/goals", { name: "Laptop", targetAmount: 80000, targetDate: "2026-12-20", priority: "medium" });
            await call("POST", "/api/goals", { name: "Trip", targetAmount: 150000, targetDate: "2026-11-20", priority: "low" });
            await call("POST", "/api/goals", { name: "Books", targetAmount: 20000, targetDate: "2027-01-10", priority: "high" });
        }
        const names = async (qs: string) => (await call("GET", `/api/goals${qs}`)).body.goals.map((g: { name: string }) => g.name);

        it("Scenario 10: sorts by target date, soonest first, and reversed on request", async () => {
            await seed();
            assert.deepEqual(await names("?sort=targetDate"), ["Trip", "Laptop", "Books"]);
            assert.deepEqual(await names("?sort=targetDate&order=desc"), ["Books", "Laptop", "Trip"]);
        });

        it("sorts by target amount, largest first by default", async () => {
            await seed();
            assert.deepEqual(await names("?sort=targetAmount"), ["Trip", "Laptop", "Books"]);
            assert.deepEqual(await names("?sort=targetAmount&order=asc"), ["Books", "Laptop", "Trip"]);
        });

        it("sorts by priority, high first, and breaks ties by the soonest date", async () => {
            await seed();
            await call("POST", "/api/goals", { name: "Phone", targetAmount: 1000, targetDate: "2026-11-05", priority: "high" });
            assert.deepEqual(await names("?sort=priority"), ["Phone", "Books", "Laptop", "Trip"]);
        });

        it("Scenario 11: sorting an empty list returns an empty list", async () => {
            for (const sort of ["priority", "targetDate", "targetAmount"]) {
                const res = await call("GET", `/api/goals?sort=${sort}`);
                assert.equal(res.status, 200);
                assert.deepEqual(res.body.goals, []);
            }
        });

        it("rejects an unknown sort field", async () => {
            assert.equal((await call("GET", "/api/goals?sort=name; DROP TABLE goals")).status, 400);
        });
    });

    describe("access control", () => {
        it("a user cannot see, change, delete or contribute to another user's goal", async () => {
            const { body } = await createLaptop();
            const id = body.goal.id;
            assert.deepEqual((await call("GET", "/api/goals", undefined, otherCookie)).body.goals, []);
            assert.equal((await call("PATCH", `/api/goals/${id}`, { name: "Hacked" }, otherCookie)).status, 404);
            assert.equal((await call("DELETE", `/api/goals/${id}?confirm=true`, undefined, otherCookie)).status, 404);
            assert.equal((await call("POST", `/api/goals/${id}/contributions`, { amount: 5 }, otherCookie)).status, 404);
            assert.equal((await call("GET", "/api/goals")).body.goals[0].name, "Laptop Fund");
        });

        it("malformed goal ids are treated as not found", async () => {
            assert.equal((await call("DELETE", "/api/goals/abc?confirm=true")).status, 404);
        });
    });
});
