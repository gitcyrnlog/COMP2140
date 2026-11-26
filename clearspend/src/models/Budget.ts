export interface BudgetInput {
    category: string;
    month: string;
    limit: number;
}

export interface Budget extends BudgetInput {
    id: string;
    spent: number | null;
    remaining: number | null;
    percentUsed: number | null;
    status: "within" | "near" | "reached" | "unavailable";
}

export interface BudgetSnapshot {
    budgets: Budget[];
    spendingAvailable: boolean;
}
