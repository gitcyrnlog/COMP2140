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
