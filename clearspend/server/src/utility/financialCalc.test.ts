import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { daysBetween, isValidIsoDate } from "./dates.js";
import { dollarsToCents, hasValidPrecision, newlyReachedMilestones, paceFor, percentComplete, reachedMilestones } from "./financialCalc.js";

describe("percentComplete", () => {
    it("is exact for the SRS example: JMD $20,000 of $80,000 is 25%", () => {
        assert.equal(percentComplete(dollarsToCents(20000), dollarsToCents(80000)), 25);
    });
    it("rounds down so 99.99% is not shown as 100%", () => {
        assert.equal(percentComplete(9999, 10000), 99.9);
    });
    it("is capped at 100 and is 0 with nothing saved", () => {
        assert.equal(percentComplete(20000, 10000), 100);
        assert.equal(percentComplete(0, 10000), 0);
    });
});

describe("milestones", () => {
    it("reports the milestones reached", () => {
        assert.deepEqual(reachedMilestones(5000, 10000), [25, 50]);
        assert.deepEqual(reachedMilestones(4999, 10000), [25]);
        assert.deepEqual(reachedMilestones(10000, 10000), [25, 50, 75, 100]);
    });
    it("reports only newly reached milestones", () => {
        const before = { savedCents: 2500, targetCents: 10000 };
        assert.deepEqual(newlyReachedMilestones(before, { savedCents: 5000, targetCents: 10000 }), [50]);
        assert.deepEqual(newlyReachedMilestones(before, { savedCents: 2600, targetCents: 10000 }), []);
        assert.deepEqual(newlyReachedMilestones(before, { savedCents: 10000, targetCents: 10000 }), [50, 75, 100]);
    });
});

describe("paceFor (required saving pace)", () => {
    const base = { targetCents: 100000, startDate: "2026-11-01", targetDate: "2026-12-01" };
    it("is not behind on the day the goal is created", () => {
        assert.equal(paceFor({ ...base, savedCents: 0, today: "2026-11-01" }).status, "on_track");
    });
    it("is behind when saved is below the straight-line pace (25 of 30 days, 40% saved)", () => {
        assert.equal(paceFor({ ...base, savedCents: 40000, today: "2026-11-26" }).status, "behind");
    });
    it("is not behind exactly on pace or ahead of it", () => {
        // 15 of 30 days elapsed -> 50% expected
        assert.equal(paceFor({ ...base, savedCents: 50000, today: "2026-11-16" }).status, "on_track");
        assert.equal(paceFor({ ...base, savedCents: 90000, today: "2026-11-26" }).status, "on_track");
    });
    it("is completed once the target is reached", () => {
        assert.equal(paceFor({ ...base, savedCents: 100000, today: "2026-11-30" }).status, "completed");
    });
    it("works out the days left and the amount needed per day", () => {
        const pace = paceFor({ ...base, savedCents: 40000, today: "2026-11-26" });
        assert.equal(pace.daysLeft, 5);
        assert.equal(pace.requiredPerDayCents, 12000);
    });
});

describe("amount and date helpers", () => {
    it("accepts at most two decimal places", () => {
        assert.equal(hasValidPrecision(80000.5), true);
        assert.equal(hasValidPrecision(0.1 + 0.2), true);
        assert.equal(hasValidPrecision(10.001), false);
    });
    it("validates ISO dates and counts days", () => {
        assert.equal(isValidIsoDate("2026-02-30"), false);
        assert.equal(isValidIsoDate("2026-12-01"), true);
        assert.equal(daysBetween("2026-11-01", "2026-12-01"), 30);
    });
});
