# FR6 – Recurring Expense Management

## 1. Overview

The Recurring Expense Management feature allows ClearSpend users to manage regular expenses such as rent, transportation, subscriptions and utility bills. Users can schedule expenses to repeat weekly or monthly, allowing the system to automatically record payments when they become due without requiring repeated manual entry.

## 2. Functional Requirements

The feature supports the following functionality:

- Creating recurring expenses by entering an expense name, amount, category, frequency and start date.
- Selecting weekly or monthly payment frequencies.
- Viewing existing recurring expenses and their next scheduled payment dates.
- Automatically recording expenses when their scheduled dates arrive.
- Editing and deleting recurring expenses.
- Preserving previously recorded payments when recurring expenses are edited or deleted.
- Validating expense information before saving.
- Preventing duplicate scheduled payment records.

## 3. Implementation

### Frontend

The frontend was developed using React, TypeScript and CSS. A dedicated recurring expenses page was created, allowing users to create, view, edit and delete recurring expenses.

The interface includes a form for entering expense information, a list of active recurring expenses and a history of automatically recorded payments. Success and error messages provide feedback when users perform operations.

A navigation button was added to the main application, allowing authenticated users to switch between Savings Goals and Recurring Expenses.

### Backend

The backend was developed using Node.js, Express and TypeScript. REST API endpoints handle the creation, retrieval, modification and deletion of recurring expenses.

| HTTP Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/recurring-expenses` | Retrieve recurring expenses |
| POST | `/api/recurring-expenses` | Create a recurring expense |
| PUT | `/api/recurring-expenses/:id` | Update a recurring expense |
| DELETE | `/api/recurring-expenses/:id` | Delete a recurring expense |
| GET | `/api/recurring-expenses/history` | Retrieve recorded payments |

Authentication restricts access to each user's own recurring expenses.

### Database

PostgreSQL is used to store recurring expense information and automatically recorded payments.

Recurring expense schedules and historical payment records are maintained separately. This allows users to modify or delete future scheduled expenses without affecting previously recorded payments.

Monetary amounts are stored in integer cents to reduce floating-point precision errors.

## 4. Automatic Expense Scheduling

A background scheduler checks recurring expenses to determine whether payments are due.

When an expense becomes due, the system:

1. Identifies the scheduled expense.
2. Creates a historical payment record.
3. Prevents duplicate recording of the same scheduled payment.
4. Advances the next payment date according to the selected frequency.

Weekly expenses advance by seven days, while monthly expenses advance according to the monthly schedule.

For example, a monthly rent expense scheduled for November 25, 2026, is automatically recorded when due, and its next payment date advances to December 25, 2026.

## 5. Files Created and Modified

| File | Description |
|---|---|
| `server/src/recurringExpenses/recurringExpenseRoutes.ts` | Backend API, database initialization and scheduling logic |
| `server/src/index.ts` | Registers the recurring expense API and starts the scheduler |
| `src/pages/RecurringExpensesPage.tsx` | Recurring expense management interface |
| `src/pages/RecurringExpenses.css` | Styling and responsive layout |
| `src/App.tsx` | Navigation and integration with the main application |

## 6. Testing

Manual functional testing was performed using the locally running ClearSpend application and PostgreSQL database.

| Test Case | Expected Result | Status |
|---|---|---|
| Create monthly recurring expense | Expense is saved and displayed | Passed |
| View recurring expenses | Saved expenses and scheduled dates are displayed | Passed |
| Automatic expense recording | Due expense appears in payment history | Passed |
| Monthly scheduling | Next payment date advances by one month | Passed |
| Weekly scheduling | Next payment date advances by seven days | Passed |
| Edit recurring expense | Updated information is saved | Passed |
| Preserve historical payments | Previously recorded amounts remain unchanged | Passed |
| Delete recurring expense | Expense is removed from active schedules | Passed |
| Preserve history after deletion | Previously recorded payments remain available | Passed |
| Invalid expense information | Invalid input is rejected | Further verification required |
| Duplicate payment prevention | A scheduled payment is recorded only once | Further verification required |

### Example Test

A recurring expense named Monthly Rent was created with the following information:

- Amount: JMD $50,000
- Category: Housing
- Frequency: Monthly
- Scheduled payment date: November 25, 2026

The system successfully recorded the payment and advanced the next payment date to December 25, 2026.

## 7. Current Limitations and Future Improvements

The recurring expense feature currently maintains its own payment history. Integration with the shared Spending Management and Budget Management features is required so that automatically recorded expenses appear in general spending records and contribute to budget calculations.

Automatic scheduling also depends on the backend server being operational.

Potential future improvements include:

- Integration with spending records and budget calculations.
- Notifications for upcoming recurring payments.
- Additional payment frequencies.
- Options to pause and resume recurring expenses.
- Automated unit and integration testing.

## 8. Version Control

The feature was developed on the `FR6_RecurringExpenses` branch and uploaded to the group's GitHub repository.

Initial implementation commit: `205a42a`

Commit message: Implement FR6 Recurring Expense Management

## 9. Conclusion

The standalone FR6 implementation successfully provides recurring expense creation, viewing, editing, deletion and automatic payment recording. It reduces the need for manual expense entry and helps users manage regular financial commitments.

The core functionality has been tested locally, with shared spending and budget integration remaining outstanding.