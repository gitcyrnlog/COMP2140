import { useState } from 'react';
import BudgetOverview from './pages/BudgetOverview';
import RegisterForm from './components/RegisterForm';

function App() {
  const [showRegistration, setShowRegistration] = useState(false);

  if (showRegistration) {
    return (
      <main className="overview-page">
        <header className="overview-header">
          <a className="overview-brand" href="/" aria-label="ClearSpend home">
            ClearSpend
          </a>
          <button
            type="button"
            className="overview-button overview-button-secondary"
            onClick={() => setShowRegistration(false)}
          >
            Back to budget overview
          </button>
        </header>
        <div className="overview-content">
          <section className="overview-panel">
            <RegisterForm />
          </section>
        </div>
      </main>
    );
  }

  return <BudgetOverview onRegister={() => setShowRegistration(true)} />;
}

export default App;
