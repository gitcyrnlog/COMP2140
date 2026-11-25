import { useState } from "react";
import type { FormEvent } from "react";
import type { User } from "../models/User";
import { login } from "../services/AuthService";
import { ApiError } from "../services/ApiClient";

export default function LoginForm({ onLoggedIn, notice }: { onLoggedIn: (user: User) => void; notice?: string }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending) return;
        setError("");
        setPending(true);
        try {
            onLoggedIn(await login(email.trim(), password));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
        } finally {
            setPending(false);
        }
    }

    return (
        <section aria-labelledby="login-heading">
            <h1 id="login-heading">Log in to ClearSpend</h1>
            {notice && <p role="status">{notice}</p>}
            <form onSubmit={handleSubmit} aria-busy={pending}>
                <fieldset disabled={pending}>
                    <legend>Your account</legend>
                    <p>
                        <label htmlFor="login-email">Email</label>
                        <br />
                        <input
                            id="login-email"
                            type="email"
                            autoComplete="email"
                            required
                            maxLength={254}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </p>
                    <p>
                        <label htmlFor="login-password">Password</label>
                        <br />
                        <input
                            id="login-password"
                            type="password"
                            autoComplete="current-password"
                            required
                            maxLength={128}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </p>
                    <button type="submit">{pending ? "Logging in..." : "Log in"}</button>
                </fieldset>
                {error && <p role="alert">{error}</p>}
            </form>
        </section>
    );
}
