import type { Expense, ExpenseInput } from "../models/Expense";
import { api } from "./ApiClient";

export async function listExpenses(): Promise<Expense[]> {
  return (await api<{ expenses: Expense[] }>("/api/expenses")).expenses;
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  return (
    await api<{ expense: Expense }>("/api/expenses", {
      method: "POST",
      body: input,
    })
  ).expense;
}

export async function updateExpense(
  id: string,
  input: ExpenseInput,
): Promise<Expense> {
  return (
    await api<{ expense: Expense }>(`/api/expenses/${id}`, {
      method: "PUT",
      body: input,
    })
  ).expense;
}

export async function deleteExpense(id: string): Promise<void> {
  await api<void>(`/api/expenses/${id}`, { method: "DELETE" });
}