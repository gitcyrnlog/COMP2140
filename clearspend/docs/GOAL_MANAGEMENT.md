# FR1 Goal Management (Ashay Phillips)

Create, track and modify savings goals. Built to the SRS FR1 acceptance criteria (AC-2.1 to AC-2.5) and the SDS layers
(Application Services: goals; Utility Services: data management, financial calculations, authentication; FR4 notifications).

## Run it

```bash
# 1. Database: any PostgreSQL. Put its address in server/.env  (the file is git-ignored)
#    DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/clearspend
# 2. API (tables are created automatically at start-up from server/db/schema.sql)
cd server && npm install && npm run dev        # http://127.0.0.1:3001
# 3. Web app (second terminal)
cd .. && npm install && npm run dev            # http://localhost:5173  (proxies /api to the API)
```

Register on the home page (password 15+ characters), log in, and the Goals screen opens.

## Tests

```bash
cd server
TEST_DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/clearspend_test npm test
```

`npm test` runs 37 tests. The database tests are skipped when `TEST_DATABASE_URL` is not set. **They empty the users table in
that database, so point it at a throwaway test database, never your real data.**

## Files

| Layer | File |
|---|---|
| Controller | `server/src/goals/goalRoutes.ts` |
| Application | `server/src/goals/goalService.ts`, `goalAlerts.ts`, `goalSchemas.ts` |
| Data management | `server/src/goals/goalRepository.ts`, `server/db/schema.sql`, `server/src/db/migrate.ts` |
| Financial calculation | `server/src/utility/financialCalc.ts`, `dates.ts` |
| FR4 hook | `server/src/utility/notifications.ts` (alerts are stored here; FR4 reads them as the history) |
| Login / session | `server/src/auth/session.ts`, `authRoutes.ts` |
| Screens | `src/pages/GoalsPage.tsx`, `src/components/goals/*`, `src/components/LoginForm.tsx` |
| Services | `src/services/GoalService.ts`, `AuthService.ts`, `ApiClient.ts` |

Changes to existing files: `server/src/index.ts` (mounts the routers, runs the schema and starts the hourly goal check),
`server/package.json` (test script), `src/App.tsx` (login, session check and the Goals screen; the broken absolute import
was replaced by a relative one).

## API (all need a logged-in user)

| Method and path | Purpose |
|---|---|
| `GET /api/goals?sort=priority\|targetDate\|targetAmount&order=asc\|desc` | List goals (AC-2.5) |
| `POST /api/goals` `{name, targetAmount, targetDate, priority?}` | Create (AC-2.1) |
| `POST /api/goals/:id/contributions` `{amount}` | Add savings, returns the updated goal (AC-2.2) |
| `PATCH /api/goals/:id` `{name?, targetAmount?, targetDate?, priority?, confirmDecrease?}` | Edit. A lower target returns 409 until `confirmDecrease: true` (AC-2.4) |
| `DELETE /api/goals/:id?confirm=true` | Delete. Without `confirm=true` it returns 409 and deletes nothing (AC-2.4) |
| `GET /api/notifications?unread=true`, `POST /api/notifications/:id/read` | Goal alerts (AC-2.3) |
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Session (expires after 15 minutes idle) |

## Rules used

* Money is stored as whole cents, so progress is exact. The percentage is rounded down (99.99% never shows as 100%).
* Target date must be after today (Jamaica time). Priority is optional and defaults to medium.
* **Required pace** = a straight line from the day the goal was created (0%) to the target date (100%). A goal is "behind"
  only when saved is strictly below that line, so goals on schedule or ahead never raise an alert. One behind alert is sent
  per stretch of being behind; it re-arms once the goal is back on pace.
* Each milestone (25/50/75/100%) alerts once per goal. 100% is the completion alert.
* Editing the target amount or date also adds a "goal modified" notification (FR4 criterion).

## SRS scenarios covered by tests (`server/src/goals/goals.test.ts`)

| Scenario | Test |
|---|---|
| S1 create "Laptop Fund" JMD $80,000 | `Scenario 1` |
| S2 reject $0 or a past date | `Scenario 2` (two tests) |
| S3 25% after $20,000 | `Scenario 3` |
| S4 unchanged without a contribution | `Scenario 4` |
| S5 milestone alert | `Scenario 5` |
| S6 behind schedule (5 days left, 40% saved) | `Scenario 6` |
| S7 no false alerts | `Scenario 7` |
| S8 delete after confirming | `Scenario 8` |
| S9 decrease target needs confirming | `Scenario 9` |
| S10 / S11 sorting, and an empty list | `Scenario 10`, `Scenario 11` |
