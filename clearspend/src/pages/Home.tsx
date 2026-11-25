import BrandMark from "../components/BrandMark";

type HomeProps = {
  onGetStarted: () => void;
  onSignIn: () => void;
};

type IconName = "overview" | "transactions" | "budgets" | "goals";

const features: { icon: IconName; title: string; description: string }[] = [
  {
    icon: "overview",
    title: "Overview",
    description:
      "See your balance, planned bills and savings together in one place.",
  },
  {
    icon: "transactions",
    title: "Transactions",
    description:
      "Record income and expenses, and organize them into categories.",
  },
  {
    icon: "budgets",
    title: "Budgets",
    description:
      "Set monthly category limits and keep track of your spending.",
  },
  {
    icon: "goals",
    title: "Goals",
    description:
      "Choose a savings target and follow your progress over time.",
  },
];

const sampleBudgets = [
  { name: "Groceries", spent: 312, limit: 450 },
  { name: "Dining out", spent: 187, limit: 200 },
  { name: "Transport", spent: 64, limit: 160 },
];

function FeatureIcon({ name }: { name: IconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "overview":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "transactions":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M12 6.5v11M14.8 9.5c0-1.1-1.2-1.8-2.8-1.8s-2.8.7-2.8 1.8 1.2 1.6 2.8 1.9 2.8.8 2.8 1.9-1.2 1.8-2.8 1.8-2.8-.7-2.8-1.8" />
        </svg>
      );
    case "budgets":
      return (
        <svg {...common}>
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
      );
    case "goals":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
  }
}

export default function Home({ onGetStarted, onSignIn }: HomeProps) {
  return (
    <div className="landing">
      <header className="landing-header container">
        <a className="brand" href="#" aria-label="ClearSpend home">
          <BrandMark />
          <span>ClearSpend</span>
        </a>

        <nav aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
        </nav>

        <div className="landing-actions">
          <button className="text-button" onClick={onSignIn}>
            Sign in
          </button>
          <button className="button" onClick={onGetStarted}>
            Get started
          </button>
        </div>
      </header>

      <main>
        <section className="landing-hero container">
          <div className="hero-copy">
            <h1>Know what you can spend before you spend it.</h1>

            <p className="hero-description">
              ClearSpend helps university students track expenses, plan a
              budget and work toward savings goals.
            </p>

            <div className="hero-cta">
              <button className="button large" onClick={onGetStarted}>
                Start with ClearSpend
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
              <span className="hero-note">Made for university students.</span>
            </div>
          </div>

          <section
            className="preview-card"
            aria-label="Example financial overview"
          >
            <div className="preview-top">
              <p className="preview-label">Safe to spend until Nov 30</p>
              <span className="preview-tag">Example</span>
            </div>
            <strong className="preview-amount">$1,284</strong>
            <p className="preview-sub">$42 a day after bills and savings</p>

            <div className="preview-budgets">
              {sampleBudgets.map((b) => {
                const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
                const warn = pct >= 90;
                return (
                  <div className="preview-budget" key={b.name}>
                    <div className="budget-label">
                      <span>{b.name}</span>
                      <span>
                        ${b.spent} / ${b.limit}
                      </span>
                    </div>
                    <div className={`progress${warn ? " warning" : ""}`}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </section>

        <section id="features" className="features-section">
          <div className="container">
            <h2>Four places. Everything about your money.</h2>

            <div className="feature-grid">
              {features.map((feature) => (
                <article className="feature-card" key={feature.title}>
                  <h3>
                    <FeatureIcon name={feature.icon} />
                    {feature.title}
                  </h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="how-section">
          <div className="container">
            <p className="eyebrow">SMALL STEPS. MORE CLARITY.</p>
            <h2>Make a plan that fits your life.</h2>

            <div className="steps-grid">
              <article>
                <span>01</span>
                <h3>Start with your own details</h3>
                <p>
                  Enter the balance and income information you want to use in
                  your plan.
                </p>
              </article>

              <article>
                <span>02</span>
                <h3>Track what comes and goes</h3>
                <p>Add transactions as you receive income or spend.</p>
              </article>

              <article>
                <span>03</span>
                <h3>Plan for what matters</h3>
                <p>Use budgets and savings goals to guide your next steps.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="closing-wrap container">
          <div className="closing-section">
            <div>
              <h2>Start with the information you have.</h2>
              <p>Your overview fills in as you add your own financial details.</p>
            </div>
            <button className="button large light" onClick={onGetStarted}>
              Get started
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}