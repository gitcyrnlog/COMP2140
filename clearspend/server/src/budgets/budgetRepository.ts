import type pg from "pg";

type Db = Pick<pg.Pool, "query">;

export interface BudgetRow {
    id: string;
    category: string;
    month: string;
    limitCents: number;
    alertLevel: number;
}

interface StoredBudget {
    id: string;
    category: string;
    month: string;
    limit_cents: string;
    alert_level: number;
}

const columns = "id, category, to_char(month_start, 'YYYY-MM') AS month, limit_cents::text, alert_level";

function toRow(row: StoredBudget): BudgetRow {
    return {
        id: row.id, category: row.category, month: row.month,
        limitCents: Number(row.limit_cents), alertLevel: row.alert_level,
    };
}

export async function listBudgets(db: Db, userId: string, month: string): Promise<BudgetRow[]> {
    const result = await db.query<StoredBudget>(
        `SELECT ${columns} FROM budgets WHERE user_id = $1 AND month_start = $2::date
         ORDER BY lower(category), id`, [userId, `${month}-01`],
    );
    return result.rows.map(toRow);
}

export async function insertBudget(
    db: Db, input: { id: string; userId: string; category: string; month: string; limitCents: number },
): Promise<void> {
    await db.query(
        `INSERT INTO budgets (id, user_id, category, month_start, limit_cents)
         VALUES ($1, $2, $3, $4::date, $5)`,
        [input.id, input.userId, input.category, `${input.month}-01`, input.limitCents],
    );
}

export async function updateBudget(
    db: Db, userId: string, id: string, input: { category: string; month: string; limitCents: number },
): Promise<boolean> {
    const result = await db.query(
        `UPDATE budgets SET category = $3, month_start = $4::date, limit_cents = $5,
             alert_level = CASE WHEN month_start <> $4::date OR lower(btrim(category)) <> lower(btrim($3))
                                THEN 0 ELSE alert_level END,
             updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [id, userId, input.category, `${input.month}-01`, input.limitCents],
    );
    return (result.rowCount ?? 0) > 0;
}

export async function deleteBudget(db: Db, userId: string, id: string): Promise<boolean> {
    const result = await db.query("DELETE FROM budgets WHERE id = $1 AND user_id = $2", [id, userId]);
    return (result.rowCount ?? 0) > 0;
}

export async function setAlertLevel(db: Db, userId: string, id: string, level: number): Promise<void> {
    await db.query("UPDATE budgets SET alert_level = $3 WHERE id = $1 AND user_id = $2", [id, userId, level]);
}
