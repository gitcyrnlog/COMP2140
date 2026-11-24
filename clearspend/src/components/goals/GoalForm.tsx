import { useState } from "react";
import type { FormEvent } from "react";
import type { Goal, GoalInput, Priority } from "../../models/Goal";
import { ApiError } from "../../services/ApiClient";
import { tomorrow } from "./format";

interface Props {
    /** When set, the form edits this goal instead of creating a new one. */
    goal?: Goal;
    submitLabel: string;
    onSubmit: (input: GoalInput) => Promise<void>;
    onCancel?: () => void;
}

export default function GoalForm({ goal, submitLabel, onSubmit, onCancel }: Props) {
    const [name, setName] = useState(goal?.name ?? "");
    const [targetAmount, setTargetAmount] = useState(goal ? String(goal.targetAmount) : "");
    const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
    const [priority, setPriority] = useState<Priority>(goal?.priority ?? "medium");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const idPrefix = goal ? `edit-${goal.id}` : "new-goal";

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending) return;
        setError("");
        setFieldErrors({});
        const amount = Number(targetAmount);
        if (targetAmount.trim() === "" || Number.isNaN(amount)) {
            setFieldErrors({ targetAmount: "Enter the target amount as a number." });
            setError("Enter the target amount as a number.");
            return;
        }
        setPending(true);
        try {
            await onSubmit({ name: name.trim(), targetAmount: amount, targetDate, priority });
            if (!goal) {
                setName("");
                setTargetAmount("");
                setTargetDate("");
                setPriority("medium");
            }
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
                setFieldErrors(err.fieldErrors);
            } else {
                setError("Something went wrong. Please try again.");
            }
        } finally {
            setPending(false);
        }
    }

    return (
        <form className="goal-form" onSubmit={handleSubmit} aria-busy={pending} noValidate>
            <div className="goal-field">
                <label htmlFor={`${idPrefix}-name`}>Goal name</label>
                <input
                    id={`${idPrefix}-name`}
                    value={name}
                    maxLength={60}
                    placeholder="e.g. Laptop Fund"
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldErrors.name && <small className="goal-error">{fieldErrors.name}</small>}
            </div>
            <div className="goal-field">
                <label htmlFor={`${idPrefix}-amount`}>Target amount (JMD)</label>
                <input
                    id={`${idPrefix}-amount`}
                    inputMode="decimal"
                    value={targetAmount}
                    placeholder="80000"
                    onChange={(e) => setTargetAmount(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.targetAmount)}
                />
                {fieldErrors.targetAmount && <small className="goal-error">{fieldErrors.targetAmount}</small>}
            </div>
            <div className="goal-field">
                <label htmlFor={`${idPrefix}-date`}>Target date</label>
                <input
                    id={`${idPrefix}-date`}
                    type="date"
                    min={tomorrow()}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.targetDate)}
                />
                {fieldErrors.targetDate && <small className="goal-error">{fieldErrors.targetDate}</small>}
            </div>
            <div className="goal-field">
                <label htmlFor={`${idPrefix}-priority`}>Priority</label>
                <select id={`${idPrefix}-priority`} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>
            <div className="goal-actions">
                {onCancel && (
                    <button type="button" onClick={onCancel} disabled={pending}>
                        Cancel
                    </button>
                )}
                <button type="submit" className="goal-primary" disabled={pending}>
                    {pending ? "Saving..." : submitLabel}
                </button>
            </div>
            {error && <p role="alert" className="goal-error">{error}</p>}
        </form>
    );
}
