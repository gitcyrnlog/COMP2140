// Utility Services: Data Management for goals. All SQL for goals lives here.
import type pg from "pg";
import type { Priority, SortField, SortOrder } from "./goalSchemas.js";

export type Queryable = Pick<pg.Pool, "query">;

export interface GoalRow {
    id: string;
    userId: string;
    name: string;
    targetAmountCents: number;
    savedAmountCents: number;
    targetDate: string;
    startDate: string;
    priority: Priority;
    completedAt: string | null;
    behindAlertActive: boolean;
    createdAt: string;
}

const COLUMNS = `id, user_id, name,
    target_amount_cents::text AS target_amount_cents,
    saved_amount_cents::text AS saved_amount_cents,
    to_char(target_date, 'YYYY-MM-DD') AS target_date,
    to_char(start_date, 'YYYY-MM-DD') AS start_date,
    priority, completed_at, behind_alert_active, created_at`;

interface DbGoal {
    id: string;
    user_id: string;
    name: string;
    target_amount_cents: string;
    saved_amount_cents: string;
    target_date: string;
    start_date: string;
    priority: Priority;
    completed_at: Date | null;
    behind_alert_active: boolean;
    created_at: Date;
}

function toRow(r: DbGoal): GoalRow {
    return {
        id: r.id,
        userId: r.user_id,
        name: r.name,
        targetAmountCents: Number(r.target_amount_cents),
        savedAmountCents: Number(r.saved_amount_cents),
        targetDate: r.target_date,
        startDate: r.start_date,
        priority: r.priority,
        completedAt: r.completed_at ? r.completed_at.toISOString() : null,
        behindAlertActive: r.behind_alert_active,
        createdAt: r.created_at.toISOString(),
    };
}

// Whitelisted ORDER BY fragments (never built from user input). Columns are qualified with "goals." because the
// SELECT list aliases them to text, and an unqualified name in ORDER BY would sort that text instead of the real value.
const DEFAULT_ORDER: Record<SortField, SortOrder> = { priority: "asc", targetDate: "asc", targetAmount: "desc" };

function orderBy(sort: SortField, order: SortOrder): string {
    const dir = order === "desc" ? "DESC" : "ASC";
    switch (sort) {
        case "priority":
            // "asc" = high priority first. Ties are broken by the soonest target date.
            return `CASE goals.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ${dir}, goals.target_date ASC, id`;
        case "targetDate":
            return `goals.target_date ${dir}, id`;
        case "targetAmount":
            return `goals.target_amount_cents ${dir}, id`;
    }
}

export function defaultOrderFor(sort: SortField): SortOrder {
    return DEFAULT_ORDER[sort];
}

export async function insertGoal(
    db: Queryable,
    goal: { id: string; userId: string; name: string; targetAmountCents: number; targetDate: string; startDate: string; priority: Priority },
): Promise<GoalRow> {
    const result = await db.query<DbGoal>(
        `INSERT INTO goals (id, user_id, name, target_amount_cents, target_date, start_date, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${COLUMNS}`,
        [goal.id, goal.userId, goal.name, goal.targetAmountCents, goal.targetDate, goal.startDate, goal.priority],
    );
    return toRow(result.rows[0]!);
}

export async function listGoals(db: Queryable, userId: string, sort: SortField, order: SortOrder): Promise<GoalRow[]> {
    const result = await db.query<DbGoal>(
        `SELECT ${COLUMNS} FROM goals WHERE user_id = $1 ORDER BY ${orderBy(sort, order)}`,
        [userId],
    );
    return result.rows.map(toRow);
}

export async function findGoal(db: Queryable, userId: string, goalId: string, lock = false): Promise<GoalRow | null> {
    const result = await db.query<DbGoal>(
        `SELECT ${COLUMNS} FROM goals WHERE id = $1 AND user_id = $2 ${lock ? "FOR UPDATE" : ""}`,
        [goalId, userId],
    );
    return result.rows[0] ? toRow(result.rows[0]) : null;
}

export async function listIncompleteGoals(db: Queryable, userId?: string): Promise<GoalRow[]> {
    const result = userId
        ? await db.query<DbGoal>(`SELECT ${COLUMNS} FROM goals WHERE completed_at IS NULL AND user_id = $1`, [userId])
        : await db.query<DbGoal>(`SELECT ${COLUMNS} FROM goals WHERE completed_at IS NULL`);
    return result.rows.map(toRow);
}

export async function updateGoalRow(
    db: Queryable,
    goalId: string,
    changes: { name: string; targetAmountCents: number; targetDate: string; priority: Priority; completed: boolean },
): Promise<GoalRow> {
    const result = await db.query<DbGoal>(
        `UPDATE goals
         SET name = $2, target_amount_cents = $3, target_date = $4, priority = $5,
             completed_at = CASE WHEN $6::boolean THEN COALESCE(completed_at, now()) ELSE NULL END,
             updated_at = now()
         WHERE id = $1
         RETURNING ${COLUMNS}`,
        [goalId, changes.name, changes.targetAmountCents, changes.targetDate, changes.priority, changes.completed],
    );
    return toRow(result.rows[0]!);
}

export async function deleteGoalRow(db: Queryable, userId: string, goalId: string): Promise<boolean> {
    const result = await db.query(`DELETE FROM goals WHERE id = $1 AND user_id = $2`, [goalId, userId]);
    return (result.rowCount ?? 0) > 0;
}

export async function addContributionRow(
    db: Queryable,
    contribution: { id: string; goalId: string; amountCents: number },
    completes: boolean,
): Promise<GoalRow> {
    await db.query(`INSERT INTO goal_contributions (id, goal_id, amount_cents) VALUES ($1, $2, $3)`, [
        contribution.id,
        contribution.goalId,
        contribution.amountCents,
    ]);
    const result = await db.query<DbGoal>(
        `UPDATE goals
         SET saved_amount_cents = saved_amount_cents + $2,
             completed_at = CASE WHEN $3::boolean THEN COALESCE(completed_at, now()) ELSE completed_at END,
             updated_at = now()
         WHERE id = $1
         RETURNING ${COLUMNS}`,
        [contribution.goalId, contribution.amountCents, completes],
    );
    return toRow(result.rows[0]!);
}

/** Atomically flips the "behind schedule alert already sent" flag. Returns true if this call changed it. */
export async function setBehindFlag(db: Queryable, goalId: string, active: boolean): Promise<boolean> {
    const result = await db.query(
        `UPDATE goals SET behind_alert_active = $2 WHERE id = $1 AND behind_alert_active = $3`,
        [goalId, active, !active],
    );
    return (result.rowCount ?? 0) > 0;
}
