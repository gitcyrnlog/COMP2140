import { useState } from "react";
import type { FormEvent } from "react";
import type { Goal, GoalInput } from "../../models/Goal";
import { ApiError } from "../../services/ApiClient";
import ConfirmDialog from "./ConfirmDialog";
import GoalForm from "./GoalForm";
import { formatDate, formatJmd } from "./format";

interface Props {
    goal: Goal;
    onContribute: (goal: Goal, amount: number) => Promise<void>;
    onUpdate: (goal: Goal, changes: Partial<GoalInput>, confirmDecrease: boolean) => Promise<void>;
    onDelete: (goal: Goal) => Promise<void>;
}

const STATUS_TEXT = { completed: "Completed", behind: "Behind schedule", on_track: "On track" } as const;

export default function GoalCard({ goal, onContribute, onUpdate, onDelete }: Props) {
    const [editing, setEditing] = useState(false);
    const [amount, setAmount] = useState("");
    const [contributionError, setContributionError] = useState("");
    const [pending, setPending] = useState(false);
    const [confirm, setConfirm] = useState<null | { kind: "delete" } | { kind: "decrease"; message: string; changes: Partial<GoalInput> }>(null);

    async function handleContribute(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending) return;
        const value = Number(amount);
        if (amount.trim() === "" || Number.isNaN(value)) {
            setContributionError("Enter the contribution amount as a number.");
            return;
        }
        setContributionError("");
        setPending(true);
        try {
            await onContribute(goal, value);
            setAmount("");
        } catch (err) {
            setContributionError(err instanceof ApiError ? err.message : "Could not record the contribution.");
        } finally {
            setPending(false);
        }
    }

    async function handleEdit(input: GoalInput) {
        const changes: Partial<GoalInput> = {};
        if (input.name !== goal.name) changes.name = input.name;
        if (input.targetAmount !== goal.targetAmount) changes.targetAmount = input.targetAmount;
        if (input.targetDate !== goal.targetDate) changes.targetDate = input.targetDate;
        if (input.priority !== goal.priority) changes.priority = input.priority;
        if (Object.keys(changes).length === 0) {
            setEditing(false);
            return;
        }
        try {
            await onUpdate(goal, changes, false);
            setEditing(false);
        } catch (err) {
            if (err instanceof ApiError && err.requiresConfirmation) {
                setConfirm({ kind: "decrease", message: err.message, changes });
                return;
            }
            throw err;
        }
    }

    async function confirmAction() {
        if (!confirm) return;
        setPending(true);
        try {
            if (confirm.kind === "delete") {
                await onDelete(goal);
            } else {
                await onUpdate(goal, confirm.changes, true);
                setEditing(false);
            }
            setConfirm(null);
        } catch (err) {
            setConfirm(null);
            setContributionError(err instanceof ApiError ? err.message : "That change could not be saved.");
        } finally {
            setPending(false);
        }
    }

    return (
        <article className={`goal-card goal-${goal.status}`} aria-label={`Savings goal ${goal.name}`}>
            <header className="goal-card-header">
                <h3>{goal.name}</h3>
                <span className={`goal-badge goal-priority-${goal.priority}`}>{goal.priority} priority</span>
                <span className={`goal-badge goal-status-${goal.status}`}>{STATUS_TEXT[goal.status]}</span>
            </header>

            <div
                className="goal-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={goal.percentComplete}
                aria-label={`${goal.name} progress`}
            >
                <div className="goal-progress-bar" style={{ width: `${goal.percentComplete}%` }} />
            </div>
            <p className="goal-numbers">
                <strong>{goal.percentComplete}%</strong> saved: {formatJmd(goal.savedAmount)} of {formatJmd(goal.targetAmount)}
            </p>
            <p className="goal-meta">
                Target date {formatDate(goal.targetDate)}
                {goal.status === "completed"
                    ? ""
                    : ` (${goal.daysLeft} day${goal.daysLeft === 1 ? "" : "s"} left). Remaining ${formatJmd(goal.remainingAmount)}, about ${formatJmd(goal.requiredPerDay)} per day.`}
            </p>

            {goal.status !== "completed" && (
                <form className="goal-contribute" onSubmit={handleContribute} aria-busy={pending}>
                    <label htmlFor={`contribute-${goal.id}`}>Add savings (JMD)</label>
                    <input
                        id={`contribute-${goal.id}`}
                        inputMode="decimal"
                        placeholder="20000"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                    <button type="submit" className="goal-primary" disabled={pending}>
                        Add
                    </button>
                </form>
            )}
            {contributionError && <p role="alert" className="goal-error">{contributionError}</p>}

            {editing ? (
                <GoalForm goal={goal} submitLabel="Save changes" onSubmit={handleEdit} onCancel={() => setEditing(false)} />
            ) : (
                <div className="goal-actions">
                    <button type="button" onClick={() => setEditing(true)}>
                        Edit
                    </button>
                    <button type="button" className="goal-danger-outline" onClick={() => setConfirm({ kind: "delete" })}>
                        Delete
                    </button>
                </div>
            )}

            {confirm?.kind === "delete" && (
                <ConfirmDialog
                    title="Delete this goal?"
                    message={`"${goal.name}" and its savings history will be removed. This cannot be undone.`}
                    confirmLabel="Delete goal"
                    busy={pending}
                    onConfirm={confirmAction}
                    onCancel={() => setConfirm(null)}
                />
            )}
            {confirm?.kind === "decrease" && (
                <ConfirmDialog
                    title="Decrease the target amount?"
                    message={confirm.message}
                    confirmLabel="Yes, decrease"
                    busy={pending}
                    onConfirm={confirmAction}
                    onCancel={() => setConfirm(null)}
                />
            )}
        </article>
    );
}
