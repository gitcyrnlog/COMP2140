import ExpensesPage from "./pages/ExpensePage";
import { useCallback, useEffect, useState } from "react";
import "./App.css";
import Home from "./pages/Home";
import LoginForm from "./components/LoginForm";
import RegisterForm from "./components/RegisterForm";
import type { User } from "./models/User";
import GoalsPage from "./pages/GoalsPage";
import RecurringExpensesPage from "./pages/RecurringExpensesPage";
import { currentUser, logout } from "./services/AuthService";
import BrandMark from "./components/BrandMark";
import BudgetsPage from "./pages/BudgetsPage";

type Page = "home" | "register" | "login";

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");

  const [dashboardPage, setDashboardPage] =
    useState<"goals" | "recurring" | "expenses" | "budgets">("goals");

  useEffect(() => {
    currentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setNotice("Your session has expired. Please log in again.");
    setDashboardPage("goals");
    setPage("login");
  }, []);

  function navigate(nextPage: Page) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function handleLogout() {
    await logout().catch(() => undefined);
    setUser(null);
    setNotice("");
    setDashboardPage("goals");
    navigate("home");
  }

  if (checking) {
    return (
      <main className="container">
        <p>Loading...</p>
      </main>
    );
  }

  if (user) {
    return (
      <div className="app">
        <header className="site-header container">
          <span className="brand">
            <BrandMark />
            ClearSpend
          </span>

          <button
            className="text-button"
            onClick={() => setDashboardPage("goals")}
          >
            Savings goals
          </button>

          <button
            className="text-button"
            onClick={() => setDashboardPage("recurring")}
          >
            Recurring expenses
          </button>

          <button
            className="text-button"
            onClick={() => setDashboardPage("expenses")}
            >
              Spending Management
            </button>
          
          <button
            className="text-button"
            onClick={() => setDashboardPage("budgets")}
            >
              Budgets and Limits
            </button>

          <span>{user.name}</span>

          <button
            className="text-button"
            onClick={() => void handleLogout()}
          >
            Log out
          </button>
        </header>

        <main>
          {dashboardPage === "goals" ? (
            <GoalsPage
              user={user}
              onSessionExpired={handleSessionExpired}
            />
          ) : dashboardPage === "recurring" ? (
            <RecurringExpensesPage
              onSessionExpired={handleSessionExpired}
            />
          ) : dashboardPage === "expenses" ? (
            <ExpensesPage
              onSessionExpired={handleSessionExpired}
            />
          ) : (
            <BudgetsPage
              user={user}
              onSessionExpired={handleSessionExpired}
            />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      {page !== "home" && (
        <header className="site-header container">
          <button
            className="brand"
            onClick={() => navigate("home")}
            aria-label="ClearSpend home"
          >
            <BrandMark />
            ClearSpend
          </button>

          <button
            className="text-button"
            onClick={() => navigate("home")}
          >
            Back to home
          </button>
        </header>
      )}

      <main>
        {page === "home" ? (
          <Home
            onGetStarted={() => navigate("register")}
            onSignIn={() => navigate("login")}
          />
        ) : page === "register" ? (
          <section className="registration-layout container">
            <div className="registration-copy">
              <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
              <h1>
                More clarity.
                <br />
                Less money stress.
              </h1>
              <p>
                Start building better habits with a budget that fits your life.
              </p>
            </div>

            <div className="registration-card">
              <RegisterForm  onRegistered={setUser} />
              <p>
                Already have an account?{" "}
                <button
                  className="text-button"
                  onClick={() => navigate("login")}
                >
                  Sign in
                </button>
              </p>
            </div>
          </section>
        ) : (
          <section className="registration-layout container">
            <div className="registration-copy">
              <p className="eyebrow">WELCOME BACK</p>
              <h1>
                Your money.
                <br />
                Your next step.
              </h1>
              {notice && <p role="status">{notice}</p>}
            </div>

            <div className="registration-card">
              <LoginForm onLoggedIn={setUser} notice={notice} />
              <p>
                New to ClearSpend?{" "}
                <button
                  className="text-button"
                  onClick={() => navigate("register")}
                >
                  Create an account
                </button>
              </p>
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer container">
        <span>© {new Date().getFullYear()} ClearSpend</span>
        <span>Small habits. A clearer future.</span>
      </footer>
    </div>
  );
}
