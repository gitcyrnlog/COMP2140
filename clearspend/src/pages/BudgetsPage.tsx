import { useCallback, useEffect, useRef, useState } from "react";
import BudgetCard from "../components/budgets/BudgetCard";
import BudgetForm from "../components/budgets/BudgetForm";
import "../components/budgets/budgets.css";
import type { Budget, BudgetInput, BudgetSnapshot } from "../models/Budget";
import type { User } from "../models/User";
import { ApiError } from "../services/ApiClient";
import * as budgetService from "../services/BudgetService";

function currentMonth() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Jamaica", year: "numeric", month: "2-digit",
    }).formatToParts(new Date());
    return `${parts.find(part => part.type === "year")!.value}-${parts.find(part => part.type === "month")!.value}`;
}

export default function BudgetsPage({ user, onSessionExpired }: { user: User; onSessionExpired: () => void }) {
    const [month, setMonth] = useState(currentMonth);
    const [snapshot, setSnapshot] = useState<BudgetSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [saving, setSaving] = useState(0);
    const request = useRef(0);

    const handleError = useCallback((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
            onSessionExpired();
            return "";
        }
        return err instanceof ApiError ? err.message : "Unable to load budgets. Please try again.";
    }, [onSessionExpired]);

    const refresh = useCallback(async () => {
        const id = ++request.current;
        try {
            const result = await budgetService.listBudgets(month);
            if (id === request.current) {
                setSnapshot(result);
                setError("");
            }
        } catch (err) {
            if (id === request.current) {
                setSnapshot(null);
                setError(handleError(err));
            }
        } finally {
            if (id === request.current) setLoading(false);
        }
    }, [month, handleError]);

    useEffect(() => {
        const id = ++request.current;
        budgetService.listBudgets(month).then(result => {
            if (id === request.current) {
                setSnapshot(result);
                setError("");
            }
        }).catch((err: unknown) => {
            if (id === request.current) {
                setSnapshot(null);
                setError(handleError(err));
            }
        }).finally(() => {
            if (id === request.current) setLoading(false);
        });
        return () => { request.current += 1; };
    }, [month, handleError]);

    async function save(input: BudgetInput, budget?: Budget) {
        setSaving(value => value + 1);
        try {
            if (budget) await budgetService.updateBudget(budget.id, input);
            else await budgetService.createBudget(input);
        } catch (err) {
            handleError(err);
            throw err;
        } finally {
            setSaving(value => value - 1);
        }
        setNotice(budget ? "Budget updated." : "Budget created.");
        await refresh();
    }

    async function remove(budget: Budget) {
        setSaving(value => value + 1);
        try {
            await budgetService.deleteBudget(budget.id);
        } catch (err) {
            handleError(err);
            throw err;
        } finally {
            setSaving(value => value - 1);
        }
        setNotice("Budget deleted.");
        await refresh();
    }

    return (
        <section className="budgets-page" aria-labelledby="budgets-heading">
            <h1 id="budgets-heading">Budgets and spending limits</h1>
            <p>Welcome, {user.name}. Set a monthly limit for each spending category.</p>
            <div className="budget-toolbar">
                <label htmlFor="budget-month">Month</label>
                <input id="budget-month" type="month" min="1000-01" max="9999-12" value={month} disabled={saving > 0}
                    onChange={event => {
                        if (/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(event.target.value)) {
                            setMonth(event.target.value);
                            setLoading(true);
                            setError("");
                            setSnapshot(null);
                            setNotice("");
                        }
                    }} />
                <button type="button" disabled={loading || saving > 0} onClick={() => { setLoading(true); void refresh(); }}>Refresh budgets</button>
            </div>
            <p role="status">{notice}</p>
            <div className="budgets-layout">
                <aside className="budget-new">
                    <BudgetForm key={month} month={month} onSubmit={input => save(input)} />
                </aside>
                <div aria-busy={loading}>
                    <h2>Your limits</h2>
                    {error && <p role="alert" className="budget-error">{error}</p>}
                    {loading ? <p>Loading your budgets...</p> : snapshot && (
                        <>
                            {!snapshot.spendingAvailable && (
                                <p className="budget-info">Expense tracking is awaiting the team's FR2 integration. You can create and manage limits now.</p>
                            )}
                            {snapshot.budgets.length === 0 ? <p>No budgets for this month. Create your first limit.</p> : (
                                <div className="budget-grid">
                                    {snapshot.budgets.map(budget => (
                                        <BudgetCard key={budget.id} budget={budget} onUpdate={(item, input) => save(input, item)} onDelete={remove} />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}
