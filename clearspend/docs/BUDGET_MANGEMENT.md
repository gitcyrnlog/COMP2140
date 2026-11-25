FR3 Spending Limits and Budget(Joseph Morgan)
This addition follows the existing React/TypeScript, Express, PostgreSQL and session conventions used by FR1.

The upload contains FR1 documentation but no FR3 SRS acceptance criteria. Monthly category limits and an 80% warning threshold are implementation assumptions to check against the team's SRS.
What works
After signing in, use the Budgets button in the header.
- Choose a calendar month.
- Create a category limit in JMD.
- Edit its category or amount.
- Confirm deletion or cancel it.
- Save limits in PostgreSQL under the signed-in account.
- Reject duplicate categories for the same month, including differences in capitalization or surrounding spaces.
- Reject invalid months, empty categories, zero or negative limits, and amounts with more than two decimal places.
- Show spending, remaining balance, usage and warnings when a trusted expense source is supplied.
Limits apply to each category independently. Expenses remain allowed when a limit is exceeded. Money uses whole cents in storage and calculations.
FR2 integration still needed
The uploaded project has no expense table, expense service or FR2 page. The production configuration therefore returns null spending values. The screen displays the integration message and leaves spending balances unavailable.

The connection point is server/src/budgets/budgetSpending.ts. A SpendingSource receives a database connection, the authenticated user ID and the selected YYYY-MM month. Implement it using the actual FR2 schema, then pass it to createBudgetsRouter(pool, { spendingSource: yourExpenseReader }) in server/src/index.ts.

The reader must return category amounts in whole JMD cents, scoped to that user and month. Include expenses on or after the first day and before the first day of the following month. An empty array means a connected ledger with no expenses. Null means an unavailable ledger. Category matching trims surrounding whitespace and ignores case.

Connect to the existing expense records rather than creating a second spending ledger. Changes made in FR2 become visible on the next budget refresh. For immediate alerts after expense mutations, have FR2 trigger the budget service's list operation for the affected month after committing its expense write. Moving an expense between months requires refreshing both months. The supplied addition has no background budget scheduler.
Alerts and FR4
With FR2 connected, budget reads and writes check usage in a transaction. At 80% the service stores budget_near_limit. At 100% or more it stores budget_limit_reached. A jump directly above 100% stores the reached alert.

The shared notifications table and existing notification API hold these records. Alerts describe the category and month. Repeated refreshes at the same level create no new alerts. Dropping to a lower level re-arms subsequent higher-level warnings. Changing the category resets the alert level. Editing a limit re-evaluates the current spending. Old notifications remain as history after a budget is deleted.

The budget card displays current warnings. The supplied FR1 Goals screen also reads the shared unread notification feed.
Files
File	Purpose
src/pages/BudgetsPage.tsx	Screen, month selection, loading, API errors and expired-session handling
src/components/budgets/BudgetForm.tsx	Create/edit form
src/components/budgets/BudgetCard.tsx	Limit, usage, editing and deletion confirmation
src/components/budgets/budgets.css	Responsive budget styling
src/models/Budget.ts	Frontend types
src/services/BudgetService.ts	Calls the budget API through the shared ApiClient
server/src/budgets/budgetSchemas.ts	Backend input validation
server/src/budgets/budgetSpending.ts	FR2 connection contract and usage calculations
server/src/budgets/budgetRepository.ts	Budget SQL
server/src/budgets/budgetService.ts	Transactions, ownership, budget actions and notifications
server/src/budgets/budgetRoutes.ts	Authenticated HTTP endpoints
server/src/budgets/budgets.test.ts	Validation, calculation and database/API checks


Existing files changed are src/App.tsx, src/App.css, server/src/index.ts, server/db/schema.sql and server/package.json. A small lint comment preserves Express's required four-argument error-handler signature. The test script runs files sequentially because the existing FR1 tests clear the shared test users table.
Run
Use Node.js 24 and PostgreSQL, following the existing setup in docs/GOAL_MANAGEMENT.md.
1. In clearspend/server, run npm ci.
2. Set DATABASE_URL in clearspend/server/.env to your development PostgreSQL database.
3. Run npm run dev in that server folder. Startup applies the additive budgets schema.
4. In another terminal, run npm ci and npm run dev in clearspend.
5. Open the Vite address, register or sign in, then select Budgets.
API
Every route uses the existing session cookie. Ownership comes from that session.
Method and path	Request or result
GET /api/budgets?month=2026-11	Returns { budgets, spendingAvailable }. Defaults to the current Jamaica month.
POST /api/budgets	Body { category, month, limit }, returns the updated month with status 201
PUT /api/budgets/:id	Complete body { category, month, limit }, returns the updated month
DELETE /api/budgets/:id	Deletes an owned budget, returns status 204


Money in requests and responses is in JMD dollars. An API caller may move a limit to another month with PUT. Duplicate destinations return 409 and roll back. The screen edits within the currently selected month.
Checks
In clearspend, run npm run build and npm run lint.

In clearspend/server, run npm run typecheck and npm test. The API suites require TEST_DATABASE_URL pointing to a disposable PostgreSQL database. The existing FR1 suite truncates users with cascading deletion. Keep this separate from development or real records.

During preparation, frontend build, frontend lint and server type checking passed. All 49 backend tests passed using a temporary embedded PostgreSQL harness, including the 12 added FR3 checks and the existing FR1 tests. That harness serialized database connections. A separate PostgreSQL service with concurrent connections remains an additional deployment check.

Browser walkthrough covered creating a limit, the FR2-pending message, connected spending supplied by the temporary test harness, editing into an exceeded limit, reloading, deleting and cancelling deletion, mobile width and navigation back to Goals. The delivered app uses the unavailable expense source until the team connects FR2.