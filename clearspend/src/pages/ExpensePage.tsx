import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Expense, ExpenseInput } from "../models/Expense";
import { ApiError } from "../services/ApiClient";
import * as expenseService from "../services/ExpenseService";
import "./Expenses.css";

const CATEGORIES = [
    "Housing",
    "Food",
    "Transport",
    "Utilities",
    "Entertainment",
    "Healthcare",
    "Education",
    "Other",
];

const emptyForm = {
    amount: "",
    category: "",
    expenseDate: "",
    description: "",
};

function formatJmd(cents: number): string {
    return (cents / 100).toLocaleString("en-JM", {
        style: "currency",
        currency: "JMD",
    });
}

export default function ExpensesPage({
    onSessionExpired,
}: {
    onSessionExpired: () => void;
}) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const loadExpenses = useCallback(async () => {
        try {
            setError("");
            setExpenses(await expenseService.listExpenses());
        } catch (cause) {
            if (cause instanceof ApiError && cause.status === 401) {
                onSessionExpired();
                return;
            }

            setError(
                cause instanceof ApiError
                    ? cause.message
                    : "Unable to load your expenses.",
            );
        } finally {
            setLoading(false);
        }
    }, [onSessionExpired]);

    useEffect(() => {
        void loadExpenses();
    }, [loadExpenses]);

    function resetForm() {
        setForm(emptyForm);
        setEditingId(null);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;

        setError("");
        setMessage("");

        const amount = Number(form.amount);
        const amountCents = Math.round(amount * 100);

        if (
            form.amount.trim() === "" ||
            !Number.isFinite(amount) ||
            amountCents <= 0 ||
            Math.abs(amount * 100 - amountCents) > 0.000001
        ) {
            setError("Enter an amount greater than zero with up to two decimal places.");
            return;
        }

        const input: ExpenseInput = {
            amountCents,
            category: form.category,
            expenseDate: form.expenseDate,
            description: form.description.trim(),
        };

        setSaving(true);

        try {
            if (editingId) {
                await expenseService.updateExpense(editingId, input);
                setMessage("Expense updated.");
            } else {
                await expenseService.createExpense(input);
                setMessage("Expense recorded.");
            }

            resetForm();
            await loadExpenses();
        } catch (cause) {
            if (cause instanceof ApiError && cause.status === 401) {
                onSessionExpired();
                return;
            }

            setError(
                cause instanceof ApiError
                    ? cause.message
                    : "Unable to save the expense.",
            );
        } finally {
            setSaving(false);
        }
    }

    function startEditing(expense: Expense) {
        setEditingId(expense.id);
        setForm({
            amount: (expense.amountCents / 100).toFixed(2),
            category: expense.category,
            expenseDate: expense.expenseDate,
            description: expense.description,
        });
        setError("");
        setMessage("");
    }

    async function handleDelete(expense: Expense) {
        if (!window.confirm(`Delete "${expense.description}"?`)) return;

        setError("");
        setMessage("");

        try {
            await expenseService.deleteExpense(expense.id);

            if (editingId === expense.id) {
                resetForm();
            }

            setMessage("Expense deleted.");
            await loadExpenses();
        } catch (cause) {
            if (cause instanceof ApiError && cause.status === 401) {
                onSessionExpired();
                return;
            }

            setError(
                cause instanceof ApiError
                    ? cause.message
                    : "Unable to delete the expense.",
            );
        }
    }

    return (
        <section className="expenses-page container">
            <h1>Spending management</h1>
            <p className="expenses-intro">
                Record and manage your expenses.
            </p>

            {message && <p role="status" className="expenses-success">{message}</p>}
            {error && <p role="alert" className="expenses-error">{error}</p>}

            <div className="expenses-layout">
                <form className="expenses-form" onSubmit={handleSubmit}>
                    <h2>{editingId ? "Edit expense" : "Record an expense"}</h2>

                    <label htmlFor="expense-amount">Amount (JMD)</label>
                    <input
                        id="expense-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        max="21474836.47"
                        required
                        value={form.amount}
                        onChange={(event) =>
                            setForm({ ...form, amount: event.target.value })
                        }
                    />

                    <label htmlFor="expense-category">Category</label>
                    <select
                        id="expense-category"
                        required
                        value={form.category}
                        onChange={(event) =>
                            setForm({ ...form, category: event.target.value })
                        }
                    >
                        <option value="" disabled>
                            Choose a category
                        </option>
                        {CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                                {category}
                            </option>
                        ))}
                    </select>

                    <label htmlFor="expense-date">Date</label>
                    <input
                        id="expense-date"
                        type="date"
                        required
                        value={form.expenseDate}
                        onChange={(event) =>
                            setForm({ ...form, expenseDate: event.target.value })
                        }
                    />

                    <label htmlFor="expense-description">Description</label>
                    <textarea
                        id="expense-description"
                        required
                        maxLength={240}
                        value={form.description}
                        onChange={(event) =>
                            setForm({ ...form, description: event.target.value })
                        }
                    />

                    <button className="expenses-primary" disabled={saving}>
                        {saving
                            ? "Saving..."
                            : editingId
                              ? "Save changes"
                              : "Record expense"}
                    </button>

                    {editingId && (
                        <button type="button" onClick={resetForm}>
                            Cancel editing
                        </button>
                    )}
                </form>

                <div className="expenses-list">
                    <h2>Your expenses</h2>

                    {loading ? (
                        <p>Loading expenses...</p>
                    ) : expenses.length === 0 ? (
                        <p className="expenses-empty">
                            You have no expenses yet. Record your first expense
                            to get started.
                        </p>
                    ) : (
                        expenses.map((expense) => (
                            <article className="expense-card" key={expense.id}>
                                <div className="expense-card-heading">
                                    <h3>{expense.description}</h3>
                                    <strong>{formatJmd(expense.amountCents)}</strong>
                                </div>

                                <p>
                                    {expense.category} · {expense.expenseDate}
                                </p>

                                <div className="expense-actions">
                                    <button
                                        type="button"
                                        onClick={() => startEditing(expense)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="expense-delete"
                                        onClick={() => void handleDelete(expense)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </article>
                        ))
                    )}
                </div>
            </div>
        </section>
    );
}