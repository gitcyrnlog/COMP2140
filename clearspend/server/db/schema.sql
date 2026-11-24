-- ClearSpend database schema (PostgreSQL). Safe to run repeatedly: every statement is idempotent.
-- Run automatically at API start-up by src/db/migrate.ts, or manually: psql "$DATABASE_URL" -f db/schema.sql

-- Users (created by registration, owned by the Authentication module)
CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY,
    name          text NOT NULL,
    email         text NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_email_unique UNIQUE (email)
);

-- Login sessions (SRS 3.2: sessions expire after 15 minutes of inactivity)
CREATE TABLE IF NOT EXISTS sessions (
    token_hash   text PRIMARY KEY,
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- FR1 Goal Management: savings goals. Money is stored as whole cents (JMD) so calculations are exact.
CREATE TABLE IF NOT EXISTS goals (
    id                  uuid PRIMARY KEY,
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                text NOT NULL,
    target_amount_cents bigint NOT NULL CHECK (target_amount_cents > 0),
    saved_amount_cents  bigint NOT NULL DEFAULT 0 CHECK (saved_amount_cents >= 0),
    target_date         date NOT NULL,
    start_date          date NOT NULL,
    priority            text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    completed_at        timestamptz,
    behind_alert_active boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goals_user_idx ON goals (user_id);

CREATE TABLE IF NOT EXISTS goal_contributions (
    id           uuid PRIMARY KEY,
    goal_id      uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    amount_cents bigint NOT NULL CHECK (amount_cents > 0),
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goal_contributions_goal_idx ON goal_contributions (goal_id);

-- FR4 Notification and Progress: notification history. FR1 writes goal alerts here; FR3 can write budget alerts.
CREATE TABLE IF NOT EXISTS notifications (
    id         uuid PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id    uuid REFERENCES goals(id) ON DELETE SET NULL,
    type       text NOT NULL,
    message    text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    read_at    timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);
-- A milestone alert (25/50/75/100%) is only ever sent once per goal.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_goal_milestone_once
    ON notifications (goal_id, type) WHERE type LIKE 'goal_milestone_%';
