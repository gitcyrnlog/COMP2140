
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./RecurringExpenses.css";

interface Expense {
    id: string;
    name: string;
    amount_cents: number;
    category: string;
    frequency: "weekly" | "monthly";
    next_date: string;
}

interface ExpenseRecord {
    id: string;
    name: string;
    amount_cents: number;
    category: string;
    expense_date: string;
}

const initialForm = {
    name: "",
    amount: "",
    category: "Housing",
    frequency: "monthly",
    nextDate: ""
};

function money(cents: number) {
    return (cents / 100).toLocaleString("en-JM", {
        style: "currency",
        currency: "JMD"
    });
}

export default function RecurringExpensesPage({
    onSessionExpired
}: {
    onSessionExpired: () => void;
}) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [history, setHistory] = useState<ExpenseRecord[]>([]);
    const [form, setForm] = useState(initialForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    async function loadExpenses() {
        try {
            const [response, records] = await Promise.all([
                fetch("/api/recurring-expenses", {
                    credentials: "include"
                }),
                fetch("/api/recurring-expenses/history", {
                    credentials: "include"
                })
            ]);

            if (response.status === 401 || records.status === 401) {
                onSessionExpired();
                return;
            }

            if (!response.ok || !records.ok) {
                throw new Error("Unable to load recurring expenses.");
            }

            setExpenses(await response.json());
            setHistory(await records.json());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to load expenses.");
        }
    }

    useEffect(() => {
        void loadExpenses();

        const timer = window.setInterval(() => {
            void loadExpenses();
        }, 15000);

        return () => window.clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onSessionExpired]);

    function updateForm(field: string, value: string) {
        setForm(previous => ({
            ...previous,
            [field]: value
        }));
    }

    function resetForm() {
        setForm(initialForm);
        setEditingId(null);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setMessage("");
        setSaving(true);

        try {
            const response = await fetch(
                editingId
                    ? `/api/recurring-expenses/${editingId}`
                    : "/api/recurring-expenses",
                {
                    method: editingId ? "PUT" : "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name: form.name,
                        amountCents: Math.round(Number(form.amount) * 100),
                        category: form.category,
                        frequency: form.frequency,
                        nextDate: form.nextDate
                    })
                }
            );

            if (response.status === 401) {
                onSessionExpired();
                return;
            }

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || "Unable to save expense.");
            }

            setMessage(
                editingId
                    ? "Recurring expense updated."
                    : "Recurring expense created."
            );

            resetForm();
            await loadExpenses();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save expense.");
        } finally {
            setSaving(false);
        }
    }

    function editExpense(expense: Expense) {
        setEditingId(expense.id);

        setForm({
            name: expense.name,
            amount: String(expense.amount_cents / 100),
            category: expense.category,
            frequency: expense.frequency,
            nextDate: expense.next_date
        });

        setError("");
        setMessage("");
    }

    async function deleteExpense(id: string) {
        if (!window.confirm("Delete this recurring expense?")) return;

        setError("");
        setMessage("");

        try {
            const response = await fetch(
                `/api/recurring-expenses/${id}`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );

            if (response.status === 401) {
                onSessionExpired();
                return;
            }

            if (!response.ok) {
                throw new Error("Unable to delete expense.");
            }

            if (editingId === id) resetForm();

            setMessage("Recurring expense deleted.");
            await loadExpenses();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to delete expense.");
        }
    }

    return (
        <section className="container recurring-page">
            <h1>Recurring expenses</h1>

            <p className="recurring-description">
                Manage regular payments and automatically record
                expenses when they become due.
            </p>

            {message && (
                <p role="status" className="recurring-success">
                    {message}
                </p>
            )}

            {error && (
                <p role="alert" className="recurring-error">
                    {error}
                </p>
            )}

            <div className="recurring-layout">
                <form className="recurring-form" onSubmit={handleSubmit}>
                    <h2>
                        {editingId ? "Edit expense" : "Create recurring expense"}
                    </h2>

                    <label>
                        Expense name
                        <input
                            required
                            maxLength={100}
                            placeholder="e.g. Monthly rent"
                            value={form.name}
                            onChange={e => updateForm("name", e.target.value)}
                        />
                    </label>

                    <label>
                        Amount (JMD)
                        <input
                            required
                            type="number"
                            min="0.01"
                            max="21474836.47"
                            step="0.01"
                            placeholder="50000"
                            value={form.amount}
                            onChange={e => updateForm("amount", e.target.value)}
                        />
                    </label>

                    <label>
                        Category
                        <select
                            value={form.category}
                            onChange={e => updateForm("category", e.target.value)}
                        >
                            <option>Housing</option>
                            <option>Food</option>
                            <option>Transport</option>
                            <option>Utilities</option>
                            <option>Entertainment</option>
                            <option>Healthcare</option>
                            <option>Education</option>
                            <option>Other</option>
                        </select>
                    </label>

                    <label>
                        Frequency
                        <select
                            value={form.frequency}
                            onChange={e => updateForm("frequency", e.target.value)}
                        >
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </label>

                    <label>
                        {editingId ? "Next payment date" : "Start date"}
                        <input
                            required
                            type="date"
                            value={form.nextDate}
                            onChange={e => updateForm("nextDate", e.target.value)}
                        />
                    </label>

                    <button className="recurring-primary" disabled={saving}>
                        {saving
                            ? "Saving..."
                            : editingId
                            ? "Save changes"
                            : "Create expense"}
                    </button>

                    {editingId && (
                        <button type="button" onClick={resetForm}>
                            Cancel editing
                        </button>
                    )}
                </form>

                <div>
                    <h2>Your recurring expenses</h2>

                    {expenses.length === 0 && (
                        <div className="recurring-empty">
                            You have no recurring expenses yet.
                            Create your first expense to get started.
                        </div>
                    )}

                    {expenses.map(expense => (
                        <article className="recurring-card" key={expense.id}>
                            <div className="recurring-card-heading">
                                <h3>{expense.name}</h3>
                                <strong>{money(expense.amount_cents)}</strong>
                            </div>

                            <p>{expense.category} · {expense.frequency}</p>
                            <p>Next payment: {expense.next_date}</p>

                            <div className="recurring-actions">
                                <button
                                    className="text-button"
                                    onClick={() => editExpense(expense)}
                                >
                                    Edit
                                </button>

                                <button
                                    className="recurring-delete"
                                    onClick={() => void deleteExpense(expense.id)}
                                >
                                    Delete
                                </button>
                            </div>
                        </article>
                    ))}

                    <h2>Recorded recurring payments</h2>

                    {history.length === 0 && (
                        <div className="recurring-empty">
                            No recurring payments have been recorded yet.
                        </div>
                    )}

                    {history.map(record => (
                        <article className="recurring-card" key={record.id}>
                            <div className="recurring-card-heading">
                                <h3>{record.name}</h3>
                                <strong>{money(record.amount_cents)}</strong>
                            </div>

                            <p>{record.category} · {record.expense_date}</p>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
