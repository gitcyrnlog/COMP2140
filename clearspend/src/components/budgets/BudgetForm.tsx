import { useState } from "react";
import type { FormEvent } from "react";
import type { Budget, BudgetInput } from "../../models/Budget";
import { ApiError } from "../../services/ApiClient";

interface Props {
    month: string;
    budget?: Budget;
    onSubmit: (input: BudgetInput) => Promise<void>;
    onCancel?: () => void;
}

export default function BudgetForm({ month, budget, onSubmit, onCancel }: Props) {
    const [category, setCategory] = useState(budget?.category ?? "");
    const [limit, setLimit] = useState(budget ? String(budget.limit) : "");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const prefix = budget ? `edit-budget-${budget.id}` : "new-budget";

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending) return;
        setError("");
        if (!category.trim() || !/^\d+(\.\d{1,2})?$/.test(limit) || Number(limit) <= 0 || Number(limit) > 999999999.99) {
            setError("Enter a category and a limit from JMD $0.01 to $999,999,999.99, using up to two decimal places.");
            return;
        }
        setPending(true);
        try {
            await onSubmit({ category: category.trim(), month, limit: Number(limit) });
            if (!budget) {
                setCategory("");
                setLimit("");
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Unable to save the budget. Please try again.");
        } finally {
            setPending(false);
        }
    }

    return (
        <form className="budget-form" onSubmit={submit} aria-busy={pending}>
            <fieldset disabled={pending}>
                <legend>{budget ? "Edit budget" : "Create a budget"} for {month}</legend>
                <label htmlFor={`${prefix}-category`}>Category</label>
                <input id={`${prefix}-category`} value={category} maxLength={60} required
                    placeholder="e.g. Food" onChange={event => setCategory(event.target.value)} />
                <label htmlFor={`${prefix}-limit`}>Monthly limit (JMD)</label>
                <input id={`${prefix}-limit`} value={limit} inputMode="decimal" required
                    onChange={event => setLimit(event.target.value)} />
                <div className="budget-actions">
                    <button type="submit">{pending ? "Saving..." : budget ? "Save changes" : "Create budget"}</button>
                    {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
                </div>
            </fieldset>
            {error && <p role="alert" className="budget-error">{error}</p>}
        </form>
    );
}
