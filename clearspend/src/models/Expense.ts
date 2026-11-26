export interface Expense {
    id: string;
    amountCents: number;
    category: string;
    expenseDate: string;
    description: string;
    createdAt: string;
}

export interface ExpenseInput {
    amountCents: number;
    category: string;
    expenseDate: string;
    description: string;
}