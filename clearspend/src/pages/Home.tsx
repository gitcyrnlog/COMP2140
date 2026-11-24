type HomeProps = {
     onGetStarted: () => void;
};

const features = [
    {
        title: "Overview",
        description:
            "See your balance, spending and upcoming bills together.Understand where you stand before making your next purchase"
    },
    {
        title: "Transactions",
        description:
            "Record income and everyday expenses. Organize your purchases into categories and see where your money goes.",
    },
    {
        title: "Budgets",
        description:
            "Set monthly spending limits that fit the student life. Track each category and spot when you are getting close.",
    },
    {
        title: "Goals",
        description:
            "Save toward tuition, a new laptop or an emergency fund. Give your savings a target and track your progress."
    },
];

export default function Home({ onGetStarted }: HomeProps){
    return (
        <>
            <section className="hero container">
                <div className="hero-copy">
                    <p className="eyebrow">
                        LESS MONETARY STRESS. MORE CLARITY
                    </p>

                    <h1>
                        Know your money.
                        <br />
                        Make room for
                        <br />
                        <em>what matters.</em>
                    </h1>

                    <p className="hero-description">
                        Student life has enough surprises. ClearSpend helps
                        you track expenses, plan your budget and save for
                        what comes next.
                    </p>

                    <div className="hero-actions">
                        <button
                            className="button"
                            onClick={onGetStarted}>
                                Start with ClearSpend
                            </button>

                            <span>Better habits start with a clearer picture.</span>
                    </div>

                </div>
                <div className="money-preview">
                    <p>Available to spend</p>
                    <div className="empty-value" aria-label="No balance entered">—</div>
                    <div className="preview-budgets">
                        <h3>Your budgets</h3>
                        <p className="empty-message">No budgets added.</p>
                    </div>
                </div>
            </section>

            <section id="how-it-works" className="how-section">
                <div className="container">
                    <p className="eyebrow">SMALL STEPS. MORE CONTROL.</p>

                    <h2>From "where did it go" to "I have a plan"</h2>

                    <div className="steps">
                        <article>
                            <h3>Start with your balance</h3>
                            <p>
                                Know what you have and record the money coming in.
                            </p>
                        </article>

                        <article>
                            <h3>Give spending a place</h3>
                            <p>
                                Categorize expenses and set limits for the month.
                            </p>
                        </article>

                        <article>
                            <h3>Keep your future in view</h3>
                            <p>
                                Plan ahead for bills and the things you want to save for.
                            </p>
                        </article>
                    </div>
                </div>
            </section>

            <section id="features" className="features-section">
                <div className="container">
                    <h2>Four places. A cleaner picture of your money</h2>

                    <div className="feature-grid">
                        {features.map((feature) => (
                            <article
                                className="feature"
                                key={feature.title}
                                >
                                    <h3>{feature.title}</h3>
                                    <p>{feature.description}</p>
                                </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="closing-section container">
                <div>
                    <h2>Your next chapter. A clearer financial start.</h2>
                    <p>
                        Built around student life and everyday money decisions
                    </p>
                </div>

                <button
                    className="button"
                    onClick={onGetStarted}
                    >
                        Get Started
                    </button>
            </section>
        </>
    );
}
