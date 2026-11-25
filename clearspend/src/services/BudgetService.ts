import type { BudgetInput, BudgetSnapshot } from "../models/Budget";
import { api } from "./ApiClient";

export function listBudgets(month: string): Promise<BudgetSnapshot> {
    return api(`/api/budgets?month=${encodeURIComponent(month)}`);
}

export function createBudget(input: BudgetInput): Promise<BudgetSnapshot> {
    return api("/api/budgets", { method: "POST", body: input });
}

export function updateBudget(id: string, input: BudgetInput): Promise<BudgetSnapshot> {
    return api(`/api/budgets/${encodeURIComponent(id)}`, { method: "PUT", body: input });
}

export function deleteBudget(id: string): Promise<void> {
    return api(`/api/budgets/${encodeURIComponent(id)}`, { method: "DELETE" });
}
