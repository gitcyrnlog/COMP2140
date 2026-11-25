import { useState } from "react";
import type { Budget, BudgetInput } from "../../models/Budget";
import { ApiError } from "../../services/ApiClient";
import { formatJmd } from "../goals/format";
import BudgetForm from "./BudgetForm";

interface Props {
    budget: Budget;
    onUpdate: (budget: Budget, input: BudgetInput) => Promise<void>;
    onDelete: (budget: Budget) => Promise<void>;
}

export default function BudgetCard({ budget, onUpdate, onDelete }: Props) {
    const [editing, setEditing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");

    async function remove() {
        if (pending) return;
        setPending(true);
        setError("");
        try {
            await onDelete(budget);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Unable to delete the budget. Please try again.");
        } finally {
            setPending(false);
        }
    }

    return (
        <article className="budget-card" aria-labelledby={`budget-${budget.id}`}>
            <h3 id={`budget-${budget.id}`}>{budget.category}</h3>
            <p>Monthly limit <strong>{formatJmd(budget.limit)}</strong></p>
            {budget.spent === null || budget.remaining === null || budget.percentUsed === null ? (
                <p className="budget-muted">Spending and remaining balance will appear when expense tracking is connected.</p>
            ) : (
                <>
                    <p>{formatJmd(budget.spent)} spent · {budget.percentUsed}% used</p>
                    <progress max={100} value={Math.min(budget.percentUsed, 100)} aria-label={`${budget.category} budget used`} />
                    <p>{budget.remaining < 0 ? `${formatJmd(-budget.remaining)} over budget` : `${formatJmd(budget.remaining)} remaining`}</p>
                    {budget.status === "near" && <p className="budget-warning">At least 80% of your limit is used.</p>}
                    {budget.status === "reached" && <p className="budget-warning">Your spending limit has been reached.</p>}
                </>
            )}
            {editing ? (
                <BudgetForm month={budget.month} budget={budget}
                    onSubmit={async input => { await onUpdate(budget, input); setEditing(false); }}
                    onCancel={() => setEditing(false)} />
            ) : confirming ? (
                <div role="group" aria-label={`Confirm deleting ${budget.category} budget`}>
                    <p>Delete this monthly limit?</p>
                    <div className="budget-actions">
                        <button type="button" disabled={pending} onClick={() => void remove()}>{pending ? "Deleting..." : "Confirm delete"}</button>
                        <button type="button" disabled={pending} onClick={() => setConfirming(false)}>Cancel</button>
                    </div>
                </div>
            ) : (
                <div className="budget-actions">
                    <button type="button" onClick={() => setEditing(true)}>Edit</button>
                    <button type="button" onClick={() => { setError(""); setConfirming(true); }}>Delete</button>
                </div>
            )}
            {error && <p role="alert" className="budget-error">{error}</p>}
        </article>
    );
}
