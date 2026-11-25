// Utility Services: Financial Calculation Services. Pure functions, all money handled as whole cents
// (integers) so progress figures are exact (SRS FR1: 100% accuracy).
import { daysBetween } from "./dates.js";

export const MILESTONES = [25, 50, 75, 100] as const;
export type Milestone = (typeof MILESTONES)[number];

/** Largest amount accepted for a goal target or contribution: JMD $999,999,999.99 */
export const MAX_AMOUNT_CENTS = 99_999_999_999;

export function dollarsToCents(dollars: number): number {
    return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
    return cents / 100;
}

/** True when the number has at most two decimal places (a valid JMD amount). */
export function hasValidPrecision(dollars: number): boolean {
    return Math.abs(dollars * 100 - Math.round(dollars * 100)) < 1e-6;
}

/** Percentage complete, rounded DOWN to one decimal so 99.99% is never shown as 100%. Capped at 100. */
export function percentComplete(savedCents: number, targetCents: number): number {
    if (targetCents <= 0) return 0;
    const tenths = Math.floor((savedCents * 1000) / targetCents);
    return Math.min(tenths, 1000) / 10;
}

/** The milestones (25/50/75/100) a saved amount has reached for a given target. */
export function reachedMilestones(savedCents: number, targetCents: number): Milestone[] {
    return MILESTONES.filter((m) => BigInt(savedCents) * 100n >= BigInt(m) * BigInt(targetCents));
}

/** Milestones reached after a change that were not reached before it. */
export function newlyReachedMilestones(
    before: { savedCents: number; targetCents: number },
    after: { savedCents: number; targetCents: number },
): Milestone[] {
    const already = new Set(reachedMilestones(before.savedCents, before.targetCents));
    return reachedMilestones(after.savedCents, after.targetCents).filter((m) => !already.has(m));
}

export type PaceStatus = "completed" | "behind" | "on_track";

export interface PaceInput {
    savedCents: number;
    targetCents: number;
    startDate: string;
    targetDate: string;
    today: string;
}

export interface Pace {
    status: PaceStatus;
    totalDays: number;
    elapsedDays: number;
    daysLeft: number;
    requiredPerDayCents: number;
}

/**
 * Required saving pace: savings are expected to grow in a straight line from the day the goal was
 * created (0) to the target date (100% of the target). A goal is "behind" only when what has been
 * saved is strictly less than what the straight line expects today, so goals that are on schedule
 * or ahead never trigger a false alert.
 */
export function paceFor(input: PaceInput): Pace {
    const totalDays = Math.max(daysBetween(input.startDate, input.targetDate), 1);
    const elapsedDays = Math.min(Math.max(daysBetween(input.startDate, input.today), 0), totalDays);
    const daysLeft = Math.max(daysBetween(input.today, input.targetDate), 0);
    const remaining = Math.max(input.targetCents - input.savedCents, 0);
    const requiredPerDayCents = remaining === 0 ? 0 : Math.ceil(remaining / Math.max(daysLeft, 1));

    let status: PaceStatus;
    if (input.savedCents >= input.targetCents) {
        status = "completed";
    } else if (BigInt(input.savedCents) * BigInt(totalDays) < BigInt(input.targetCents) * BigInt(elapsedDays)) {
        status = "behind";
    } else {
        status = "on_track";
    }
    return { status, totalDays, elapsedDays, daysLeft, requiredPerDayCents };
}

export function formatJmd(cents: number): string {
    return `JMD $${(cents / 100).toLocaleString("en-JM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
