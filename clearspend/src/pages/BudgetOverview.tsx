import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import './BudgetOverview.css';

const STORAGE_KEY = 'clearspend.budgetOverview.v1';
const CATEGORIES = [
  'Accommodation',
  'Academic',
  'Food',
  'Transport',
  'Utilities',
  'Entertainment',
  'Other',
] as const;

type ExpenseCategory = (typeof CATEGORIES)[number];

type Expense = {
  id: string;
  description: string;
  amountInCents: number;
  category: ExpenseCategory;
  date: string;
};

type OverviewData = {
  monthlyBudgets: Record<string, number>;
  expenses: Expense[];
};

const currencyFormatter = new Intl.NumberFormat('en-JM', {
  style: 'currency',
  currency: 'JMD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function emptyOverview(): OverviewData {
  return { monthlyBudgets: {}, expenses: [] };
}

type OverviewLoadResult = {
  data: OverviewData;
  error: string | null;
};

function readOverview(): OverviewLoadResult {
  try {
    const savedData = window.localStorage.getItem(STORAGE_KEY);
    if (savedData === null) return { data: emptyOverview(), error: null };

    const parsedData: unknown = JSON.parse(savedData);
    if (!isOverviewData(parsedData)) {
      throw new Error('The saved budget data has an invalid format.');
    }

    return { data: parsedData, error: null };
  } catch {
    return {
      data: emptyOverview(),
      error:
        'Saved overview data could not be loaded. Existing data has not been overwritten, and changes in this session will not be saved. Check your browser storage.',
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === 'string' && CATEGORIES.some((category) => category === value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && localDateString(new Date(`${value}T12:00:00`)) === value;
}

function isOverviewData(value: unknown): value is OverviewData {
  if (!isRecord(value) || !isRecord(value.monthlyBudgets) || !Array.isArray(value.expenses)) {
    return false;
  }

  const budgetsAreValid = Object.entries(value.monthlyBudgets).every(
    ([month, amount]) =>
      /^\d{4}-\d{2}$/.test(month) &&
      isNonNegativeSafeInteger(amount),
  );
  const expensesAreValid = value.expenses.every(
    (expense) =>
      isRecord(expense) &&
      typeof expense.id === 'string' &&
      typeof expense.description === 'string' &&
      expense.description.trim().length > 0 &&
      isNonNegativeSafeInteger(expense.amountInCents) &&
      expense.amountInCents > 0 &&
      isExpenseCategory(expense.category) &&
      typeof expense.date === 'string' &&
      isValidDateString(expense.date),
  );

  return budgetsAreValid && expensesAreValid;
}

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseAmountInCents(value: string): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const amountInCents = Math.round(amount * 100);
  return Number.isSafeInteger(amountInCents) && amountInCents > 0
    ? amountInCents
    : null;
}

function formatCurrency(amountInCents: number): string {
  return currencyFormatter.format(amountInCents / 100);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-JM', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

type BudgetOverviewProps = {
  onRegister: () => void;
};

function BudgetOverview({ onRegister }: BudgetOverviewProps) {
  const [initialOverview] = useState(readOverview);
  const [data, setData] = useState(initialOverview.data);
  const [storageError, setStorageError] = useState(initialOverview.error);
  const currentDate = new Date();
  const currentMonth = localDateString(currentDate).slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat('en-JM', {
    month: 'long',
    year: 'numeric',
  }).format(currentDate);
  const [budgetInput, setBudgetInput] = useState(() => {
    const savedBudget = initialOverview.data.monthlyBudgets[currentMonth];
    return savedBudget === undefined ? '' : (savedBudget / 100).toFixed(2);
  });
  const [budgetError, setBudgetError] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [expenseDate, setExpenseDate] = useState(localDateString);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const currentBudget = data.monthlyBudgets[currentMonth] ?? null;

  function saveOverview(nextData: OverviewData) {
    setData(nextData);
    if (initialOverview.error) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
      setStorageError(null);
    } catch {
      setStorageError(
        'Changes are visible but could not be saved in this browser. Check your browser storage settings.',
      );
    }
  }

  const monthExpenses = useMemo(
    () => data.expenses.filter((expense) => expense.date.slice(0, 7) === currentMonth),
    [data.expenses, currentMonth],
  );
  const spentInCents = monthExpenses.reduce(
    (total, expense) => total + expense.amountInCents,
    0,
  );
  const remainingInCents =
    currentBudget === null ? null : currentBudget - spentInCents;
  const categoryTotals = CATEGORIES.map((expenseCategory) => ({
    category: expenseCategory,
    amountInCents: monthExpenses
      .filter((expense) => expense.category === expenseCategory)
      .reduce((total, expense) => total + expense.amountInCents, 0),
  }))
    .filter((entry) => entry.amountInCents > 0)
    .sort((first, second) => second.amountInCents - first.amountInCents);
  const sortedExpenses = [...monthExpenses].sort((first, second) =>
    second.date.localeCompare(first.date),
  );

  function handleSaveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBudgetError('');
    const amountInCents = parseAmountInCents(budgetInput);

    if (amountInCents === null) {
      setBudgetError('Enter a budget greater than zero, with no more than two decimal places.');
      return;
    }

    saveOverview({
      ...data,
      monthlyBudgets: { ...data.monthlyBudgets, [currentMonth]: amountInCents },
    });
  }

  function handleRemoveBudget() {
    setBudgetError('');
    const monthlyBudgets = { ...data.monthlyBudgets };
    delete monthlyBudgets[currentMonth];
    setBudgetInput('');
    saveOverview({ ...data, monthlyBudgets });
  }

  function resetExpenseForm() {
    setDescription('');
    setAmountInput('');
    setCategory('Food');
    setExpenseDate(localDateString());
    setEditingExpenseId(null);
    setExpenseError('');
  }

  function handleSaveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExpenseError('');
    const trimmedDescription = description.trim();
    const amountInCents = parseAmountInCents(amountInput);

    if (!trimmedDescription) {
      setExpenseError('Enter a description for this expense.');
      return;
    }
    if (amountInCents === null) {
      setExpenseError('Enter an amount greater than zero, with no more than two decimal places.');
      return;
    }
    if (!isValidDateString(expenseDate)) {
      setExpenseError('Choose a valid expense date.');
      return;
    }

    const updatedExpense: Expense = {
      id: editingExpenseId ?? crypto.randomUUID(),
      description: trimmedDescription,
      amountInCents,
      category,
      date: expenseDate,
    };
    const expenses = editingExpenseId
      ? data.expenses.map((expense) =>
          expense.id === editingExpenseId ? updatedExpense : expense,
        )
      : [...data.expenses, updatedExpense];
    saveOverview({ ...data, expenses });
    resetExpenseForm();
  }

  function handleEditExpense(expense: Expense) {
    setEditingExpenseId(expense.id);
    setDescription(expense.description);
    setAmountInput((expense.amountInCents / 100).toFixed(2));
    setCategory(expense.category);
    setExpenseDate(expense.date);
    setExpenseError('');
  }

  function handleDeleteExpense(expenseId: string) {
    saveOverview({
      ...data,
      expenses: data.expenses.filter((expense) => expense.id !== expenseId),
    });
    if (editingExpenseId === expenseId) resetExpenseForm();
  }

  return (
    <main className="overview-page">
      <header className="overview-header">
        <a className="overview-brand" href="/" aria-label="ClearSpend home">
          ClearSpend
        </a>
        <p>Budget and saving overview</p>
        <button
          type="button"
          className="overview-button overview-button-secondary"
          onClick={onRegister}
        >
          Create account
        </button>
      </header>

      <div className="overview-content">
        <section className="overview-intro" aria-labelledby="overview-title">
          <div>
            <p className="overview-eyebrow">YOUR MONEY, AT A GLANCE</p>
            <h1 id="overview-title">Budget overview</h1>
            <p className="overview-subtitle">
              Track what you have spent and what remains for {monthLabel}.
            </p>
          </div>
          <span className="overview-period">{monthLabel}</span>
        </section>

        {storageError && (
          <p className="overview-alert" role="alert">
            {storageError}
          </p>
        )}

        {currentBudget === null && (
          <section className="overview-prompt" aria-labelledby="budget-prompt-title">
            <div>
              <h2 id="budget-prompt-title">Start with a monthly budget</h2>
              <p>
                Set a budget for {monthLabel} to see how much you have left to spend.
              </p>
            </div>
          </section>
        )}

        <section className="overview-stats" aria-label="Monthly budget summary">
          <article className="overview-stat">
            <h2>Monthly budget</h2>
            <p className="overview-stat-value">
              {currentBudget === null ? 'Not set' : formatCurrency(currentBudget)}
            </p>
          </article>
          <article className="overview-stat">
            <h2>Total spent</h2>
            <p className="overview-stat-value">{formatCurrency(spentInCents)}</p>
          </article>
          <article
            className={`overview-stat overview-stat-remaining${remainingInCents !== null && remainingInCents < 0 ? ' is-over-budget' : ''}`}
          >
            <h2>Remaining</h2>
            <p className="overview-stat-value">
              {remainingInCents === null
                ? 'Set a budget'
                : formatCurrency(remainingInCents)}
            </p>
            {remainingInCents !== null && (
              <p className="overview-budget-status" role="status">
                {remainingInCents < 0
                  ? `Over budget by ${formatCurrency(Math.abs(remainingInCents))}`
                  : remainingInCents === 0
                    ? 'Budget reached'
                    : 'Within budget'}
              </p>
            )}
          </article>
        </section>

        <section className="overview-panel budget-panel" aria-labelledby="budget-form-title">
          <div>
            <h2 id="budget-form-title">
              {currentBudget === null ? 'Set your monthly budget' : 'Update your monthly budget'}
            </h2>
            <p>Amounts are shown in Jamaican dollars (JMD).</p>
          </div>
          <form className="budget-form" onSubmit={handleSaveBudget}>
            <label htmlFor="monthly-budget">Budget amount (JMD)</label>
            <div className="overview-form-row">
              <input
                id="monthly-budget"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={budgetInput}
                onChange={(event) => setBudgetInput(event.target.value)}
                placeholder="e.g. 20000.00"
                required
              />
              <button type="submit" className="overview-button">
                Save budget
              </button>
              {currentBudget !== null && (
                <button
                  type="button"
                  className="overview-button overview-button-secondary"
                  onClick={handleRemoveBudget}
                >
                  Remove budget
                </button>
              )}
            </div>
            {budgetError && (
              <p className="overview-field-error" role="alert">
                {budgetError}
              </p>
            )}
          </form>
        </section>

        <div className="overview-columns">
          <section className="overview-panel" aria-labelledby="category-title">
            <div className="overview-panel-heading">
              <div>
                <h2 id="category-title">Spending by category</h2>
                <p>Breakdown of expenses recorded this month.</p>
              </div>
            </div>
            {categoryTotals.length === 0 ? (
              <p className="overview-empty">No expenses recorded for {monthLabel} yet.</p>
            ) : (
              <ul className="category-list">
                {categoryTotals.map((entry) => (
                  <li className="category-item" key={entry.category}>
                    <div className="category-label-row">
                      <span>{entry.category}</span>
                      <span>{formatCurrency(entry.amountInCents)}</span>
                    </div>
                    <div
                      className="category-track"
                      role="progressbar"
                      aria-label={`${entry.category} share of this month's spending`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round((entry.amountInCents / spentInCents) * 100)}
                    >
                      <span
                        className="category-fill"
                        style={{
                          width: `${(entry.amountInCents / spentInCents) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="overview-panel" aria-labelledby="expense-form-title">
            <div className="overview-panel-heading">
              <div>
                <h2 id="expense-form-title">
                  {editingExpenseId ? 'Edit expense' : 'Add an expense'}
                </h2>
                <p>Expenses update your remaining budget immediately.</p>
              </div>
            </div>
            <form className="expense-form" onSubmit={handleSaveExpense}>
              <label htmlFor="expense-description">Description</label>
              <input
                id="expense-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={100}
                placeholder="e.g. Groceries"
                required
              />

              <div className="expense-form-grid">
                <div>
                  <label htmlFor="expense-amount">Amount (JMD)</label>
                  <input
                    id="expense-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={amountInput}
                    onChange={(event) => setAmountInput(event.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="expense-category">Category</label>
                  <select
                    id="expense-category"
                    value={category}
                    onChange={(event) => {
                      if (isExpenseCategory(event.target.value)) {
                        setCategory(event.target.value);
                      }
                    }}
                  >
                    {CATEGORIES.map((expenseCategory) => (
                      <option key={expenseCategory} value={expenseCategory}>
                        {expenseCategory}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label htmlFor="expense-date">Date</label>
              <input
                id="expense-date"
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                required
              />

              {expenseError && (
                <p className="overview-field-error" role="alert">
                  {expenseError}
                </p>
              )}
              <div className="overview-form-row">
                <button type="submit" className="overview-button">
                  {editingExpenseId ? 'Save changes' : 'Add expense'}
                </button>
                {editingExpenseId && (
                  <button
                    type="button"
                    className="overview-button overview-button-secondary"
                    onClick={resetExpenseForm}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>

        <section className="overview-panel expense-list-panel" aria-labelledby="expense-list-title">
          <div className="overview-panel-heading">
            <div>
              <h2 id="expense-list-title">This month’s expenses</h2>
              <p>{monthExpenses.length} recorded</p>
            </div>
          </div>
          {sortedExpenses.length === 0 ? (
            <p className="overview-empty">
              Your expenses for {monthLabel} will appear here when you add them.
            </p>
          ) : (
            <ul className="expense-list">
              {sortedExpenses.map((expense) => (
                <li className="expense-row" key={expense.id}>
                  <div className="expense-main">
                    <span className="expense-name">{expense.description}</span>
                    <span className="expense-meta">
                      {expense.category} · {formatDate(expense.date)}
                    </span>
                  </div>
                  <span className="expense-amount">{formatCurrency(expense.amountInCents)}</span>
                  <div className="expense-actions">
                    <button
                      type="button"
                      className="overview-text-button"
                      onClick={() => handleEditExpense(expense)}
                      aria-label={`Edit ${expense.description}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="overview-text-button overview-delete-button"
                      onClick={() => handleDeleteExpense(expense.id)}
                      aria-label={`Delete ${expense.description}`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <footer className="overview-footer">
        Overview data is currently saved only in this browser.
      </footer>
    </main>
  );
}

export default BudgetOverview;
