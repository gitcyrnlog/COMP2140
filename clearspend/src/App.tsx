<<<<<<< HEAD
import { useState } from 'react';
import Home from './pages/Home';
import RegisterForm from './components/RegisterForm';
import './App.css';

type Page = "home" | "register";

export default function App() {
  const [page, setPage] = useState<Page>("home");

  function navigate(nextPage: Page) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  return (
    <div className='app'>
      <header className='site-header container'>
        <button
          className='brand'
          onClick={() => navigate("home")}
          aria-label='ClearSpend home'
          >
            <span className='brand-mark' aria-hidden="true">
              C
            </span>

            ClearSpend
          </button>

          {page === "home" ? (
            <>
              <nav aria-label='Main navigation'>
                <a href='#how-it-works'> How it works</a>
                <a href='#features'>Features</a>
              </nav>

              <button
                className='button'
                onClick={() => navigate("register")}
                >
                  Get Started
                </button>
            </>
        ) : (
          <button
            className='text-button'
            onClick={() => navigate("home")}
            >
              Back to home
            </button>
        )}


      </header>

      <main>
        {page === "home" ? (
          <Home onGetStarted={() => navigate("register")}/>
        ) : (
          <section className='registration-layout container'>
            <div className='registration-copy'>
              <p className='eyebrow'>
                YOUR NEXT CHAPTER STARTS HERE
              </p>

              <h1>
                More clarity.
                <br />
                Less money stress.
              </h1>

              <p>
                Start building better habits with a budget
                that fits your life
              </p>
            </div>

            <div className='registration-card'>
              <RegisterForm />
            </div>
          </section>
=======
import { useCallback, useEffect, useState } from "react";
import "./App.css";
import LoginForm from "./components/LoginForm";
import RegisterForm from "./components/RegisterForm";
import type { User } from "./models/User";
import GoalsPage from "./pages/GoalsPage";
import { currentUser, logout } from "./services/AuthService";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    currentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setNotice("Your session has expired. Please log in again.");
  }, []);

  async function handleLogout() {
    await logout().catch(() => undefined);
    setUser(null);
    setNotice("");
  }

  return (
    <div className="app">
      <header className="header">
        <h1>ClearSpend</h1>
        <nav>
          {user ? (
            <>
              <span>{user.name}</span>
              <button type="button" onClick={() => void handleLogout()}>
                Log out
              </button>
            </>
          ) : (
            <>
              <a href="#features">Features</a>
              <a href="#about">About</a>
              <a href="#login">Log in</a>
              <a href="#register">Sign up</a>
            </>
          )}
        </nav>
      </header>

      <main>
        {checking ? (
          <p>Loading...</p>
        ) : user ? (
          <GoalsPage user={user} onSessionExpired={handleSessionExpired} />
        ) : (
          <>
            <section className="hero">
              <h2>Know where your money goes.</h2>
              <p>
                ClearSpend helps UWI Mona students track their spending, stay within budget and save for the things that matter.
              </p>
              <div className="hero-actions">
                <a className="btn" href="#register">Create an account</a>
                <a className="btn btn-outline" href="#login">Log in</a>
              </div>
            </section>

            <section id="features" className="features">
              <h2>What ClearSpend offers</h2>

              <div className="feature-grid">
                <article className="feature-card">
                  <h3>Spending Management</h3>
                  <p>Record, categorize and edit your daily expenses.</p>
                </article>

                <article className="feature-card">
                  <h3>Goal Management</h3>
                  <p>Create savings goals with a target and a date, then track your progress.</p>
                </article>

                <article className="feature-card">
                  <h3>Budget and Limits</h3>
                  <p>Set spending limits and see how much of your budget is used.</p>
                </article>

                <article className="feature-card">
                  <h3>Notifications and Progress</h3>
                  <p>Get alerts for savings milestones and when spending nears a limit.</p>
                </article>

                <article className="feature-card">
                  <h3>Budget and Saving Overview</h3>
                  <p>See your remaining budget and a breakdown of spending by category.</p>
                </article>

                <article className="feature-card">
                  <h3>Recurring Expenses</h3>
                  <p>Schedule regular payments like rent or subscriptions so they record automatically.</p>
                </article>
              </div>
            </section>

            <section id="about" className="about">
              <h2>About ClearSpend</h2>
              <p>
                ClearSpend is a personal finance application designed to help university students build better financial habits.
              </p>
            </section>

            <section className="auth" aria-label="Log in or create an account">
              <div className="auth-grid">
                <div id="login" className="auth-card">
                  <LoginForm onLoggedIn={setUser} notice={notice} />
                </div>
                <div id="register" className="auth-card">
                  <RegisterForm />
                </div>
              </div>
            </section>
          </>
>>>>>>> fdd8f9b62ac2534df01e349ba642d607936314d0
        )}
      </main>

      <footer className='site-footer container'>
        <span>
          © {new Date().getFullYear()} ClearSpend
        </span>

        <span> Small habits. A clearer future.</span>
      </footer>
    </div>
  );
}
