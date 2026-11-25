// FR1 Goal Management screen: create, track, edit, delete and sort savings goals, and see goal alerts.
import { useCallback, useEffect, useState } from "react";
import GoalCard from "../components/goals/GoalCard";
import GoalForm from "../components/goals/GoalForm";
import "../components/goals/goals.css";
import type { AppNotification, Goal, GoalInput, SortField, SortOrder } from "../models/Goal";
import type { User } from "../models/User";
import { ApiError } from "../services/ApiClient";
import * as goalService from "../services/GoalService";

const SORT_OPTIONS: { value: string; label: string; sort: SortField; order: SortOrder }[] = [
    { value: "targetDate:asc", label: "Target date (soonest first)", sort: "targetDate", order: "asc" },
    { value: "targetDate:desc", label: "Target date (latest first)", sort: "targetDate", order: "desc" },
    { value: "priority:asc", label: "Priority (high first)", sort: "priority", order: "asc" },
    { value: "priority:desc", label: "Priority (low first)", sort: "priority", order: "desc" },
    { value: "targetAmount:desc", label: "Target amount (largest first)", sort: "targetAmount", order: "desc" },
    { value: "targetAmount:asc", label: "Target amount (smallest first)", sort: "targetAmount", order: "asc" },
];

export default function GoalsPage({ user, onSessionExpired }: { user: User; onSessionExpired: () => void }) {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [alerts, setAlerts] = useState<AppNotification[]>([]);
    const [sortValue, setSortValue] = useState(SORT_OPTIONS[0]!.value);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    const handleError = useCallback(
        (error: unknown): string => {
            if (error instanceof ApiError && error.status === 401) {
                onSessionExpired();
                return "";
            }
            return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
        },
        [onSessionExpired],
    );

    // Goals are loaded first: this also runs the behind-schedule check, so the alerts fetched after it are current.
    const fetchAll = useCallback(async (value: string) => {
        const option = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0]!;
        const loaded = await goalService.listGoals(option.sort, option.order);
        return { goals: loaded, alerts: await goalService.unreadNotifications() };
    }, []);

    const apply = useCallback((result: { goals: Goal[]; alerts: AppNotification[] }) => {
        setGoals(result.goals);
        setAlerts(result.alerts);
        setLoadError("");
        setLoading(false);
    }, []);

    const refresh = useCallback(
        async (value: string) => {
            try {
                apply(await fetchAll(value));
            } catch (error) {
                setLoadError(handleError(error));
                setLoading(false);
            }
        },
        [apply, fetchAll, handleError],
    );

    useEffect(() => {
        fetchAll(sortValue)
            .then(apply)
            .catch((error: unknown) => {
                setLoadError(handleError(error));
                setLoading(false);
            });
    }, [apply, fetchAll, handleError, sortValue]);

    async function handleCreate(input: GoalInput) {
        try {
            await goalService.createGoal(input);
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) onSessionExpired();
            throw error;
        }
        await refresh(sortValue);
    }

    async function handleContribute(goal: Goal, amount: number) {
        try {
            await goalService.addContribution(goal.id, amount);
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) onSessionExpired();
            throw error;
        }
        await refresh(sortValue);
    }

    async function handleUpdate(goal: Goal, changes: Partial<GoalInput>, confirmDecrease: boolean) {
        try {
            await goalService.updateGoal(goal.id, changes, confirmDecrease);
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) onSessionExpired();
            throw error;
        }
        await refresh(sortValue);
    }

    async function handleDelete(goal: Goal) {
        try {
            await goalService.deleteGoal(goal.id);
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) onSessionExpired();
            throw error;
        }
        await refresh(sortValue);
    }

    async function dismiss(alert: AppNotification) {
        setAlerts((current) => current.filter((a) => a.id !== alert.id));
        try {
            await goalService.markNotificationRead(alert.id);
        } catch (error) {
            handleError(error);
        }
    }

    return (
        <section className="goals-page" aria-labelledby="goals-heading">
            <h1 id="goals-heading">Savings goals</h1>
            <p className="goals-intro">Welcome, {user.name}. Set a target, add what you save, and stay on track.</p>

            <div className="goal-alerts" aria-live="polite">
                {alerts.map((alert) => (
                    <div key={alert.id} role="status" className={`goal-alert goal-alert-${alert.type.includes("behind") ? "warn" : "good"}`}>
                        <span>{alert.message}</span>
                        <button type="button" onClick={() => void dismiss(alert)} aria-label="Dismiss alert">
                            Dismiss
                        </button>
                    </div>
                ))}
            </div>

            <div className="goals-layout">
                <aside className="goals-new" aria-labelledby="new-goal-heading">
                    <h2 id="new-goal-heading">Create a savings goal</h2>
                    <GoalForm submitLabel="Create goal" onSubmit={handleCreate} />
                </aside>

                <div className="goals-list-area">
                    <div className="goals-toolbar">
                        <h2>Your goals</h2>
                        <label htmlFor="goal-sort">Sort by</label>
                        <select id="goal-sort" value={sortValue} onChange={(e) => setSortValue(e.target.value)}>
                            {SORT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {loadError && <p role="alert" className="goal-error">{loadError}</p>}
                    {loading ? (
                        <p>Loading your goals...</p>
                    ) : goals.length === 0 ? (
                        <p className="goals-empty">You have no savings goals yet. Create your first goal to get started.</p>
                    ) : (
                        <div className="goals-grid">
                            {goals.map((goal) => (
                                <GoalCard
                                    key={goal.id}
                                    goal={goal}
                                    onContribute={handleContribute}
                                    onUpdate={handleUpdate}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
