import type pg from "pg";

/**
 * FR2 integration contract. Return category totals in whole JMD cents for this user
 * and YYYY-MM month. Include recorded expenses on/after month start and before next
 * month start. Never accept spending totals supplied by a browser.
 */
export type SpendingSource = (
    db: Pick<pg.Pool, "query">,
    userId: string,
    month: string,
) => Promise<{ category: string; amountCents: number }[] | null>;

// The supplied repository has no FR2 expense schema or API. Null means unavailable,
// so the screen cannot accidentally present an empty ledger as verified spending.
export const unavailableSpending: SpendingSource = async () => null;

export function categoryKey(category: string): string {
    return category.trim().toLowerCase();
}

export function totalForCategory(
    spending: { category: string; amountCents: number }[],
    category: string,
): number {
    let total = 0;
    for (const entry of spending) {
        if (!Number.isSafeInteger(entry.amountCents) || entry.amountCents < 0) {
            throw new Error("Expense totals must be non-negative safe integers in cents.");
        }
        if (categoryKey(entry.category) === categoryKey(category)) {
            total += entry.amountCents;
            if (!Number.isSafeInteger(total)) throw new Error("Expense total exceeds supported precision.");
        }
    }
    return total;
}

export function usageFor(spentCents: number, limitCents: number) {
    const status = spentCents >= limitCents ? "reached"
        : BigInt(spentCents) * 100n >= BigInt(limitCents) * 80n ? "near" : "within";
    return {
        spent: spentCents / 100,
        remaining: (limitCents - spentCents) / 100,
        percentUsed: Number(BigInt(spentCents) * 1000n / BigInt(limitCents)) / 10,
        status,
    };
}
