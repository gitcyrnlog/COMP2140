import { useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'

function App() {
  return (
    <div className ="app">
      <header className="header">
        <h1>ClearSpend</h1>
        <nav>
          <a href="#features">Features</a>
          <a href="about">About</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <h2>Type something here whoever is designing the frontend</h2>
          <p>
            write something else here 
            here too
          </p>
          <button type="button">Get Started</button>
        </section>

        <section id="features" className="features">
          <h2> What ClearSpend Offers</h2>

          <div className="feature-grid">
            <article className="feature-card">
              <h3>Spending Management</h3>
              <p>Record and categorize your daily expenses.</p>
            </article>

            <article className="feature-card">
              <h3>Goal Management</h3>
              <p>Create savings goals and monitor your progress.</p>
            </article>

            <article className="feature-card">
              <h3>Budget and Limits</h3>
              <p>Establish budgets and spending limits</p>
            </article>

            



            
          </div>

        </section>

        <section id="about" className="about">
          <h2>About ClearSpend</h2>
          <p>
            ClearSpend is a personal finance management application designed to helo university students develop better financial habits.
          </p>
        </section>
      </main>
      <footer>
        <p>2026 ClearSpend. All rights reserved.</p>
      </footer>
    </div>
    
);
}

export default App;
