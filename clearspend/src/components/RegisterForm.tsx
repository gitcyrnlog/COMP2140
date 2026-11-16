import { useState } from  "react";
import type { FormEvent } from "react";

export default function RegisterForm() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (pending) return;

        setError("");
        setSuccess("");

        if (!name.trim()) {
            setError("Enter your name.");
            return;
        }

        if (password.length < 15 || password.length > 128) {
            setError("Use a password between 8 and 128 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Your passwords do not match.");
            return;
        }

        setPending(true);

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body:JSON.stringify({
                    name: name.trim(),
                    email: email.trim(),
                    password,

                }),
            });
            const data = await response.json().catch(() => null);

            if(!response.ok) {
                setError(
                    typeof data?.message === "string"
                    ? data.message
                    : "Registration failed. Please try again.",
                );
                return;
            }

            setSuccess("Your Clearspend account has been created.");
            setName("");
            setEmail("");
            setPassword("");
            setConfirmPassword("");

        }catch {
            setError("Cannot reach the server. Please try again.");
        }finally{
            setPending(false);
        }
    }
    return (
        <section aria-labelledby="register-heading">
            <h1 id="register-heading">Create your ClearSpend account</h1>

            <form onSubmit={handleSubmit} aria-busy={pending}>
                <fieldset disabled={pending}>
                    <legend>Your details</legend>

                    <p>
                        <label htmlFor="register-name">Name</label>
                        <br />
                        <input
                            id="register-name"
                            name="name"
                            autoComplete="name"
                            required
                            maxLength={80}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </p>

                    <p>
                        <label htmlFor="register-email">Email</label>
                        <br />
                        <input
                            id="register-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            maxLength={254}
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                  </p>

                  <p>
                        <label htmlFor="register-password">Password</label>
                        <br />
                        <input
                            id="register-password"
                            name="password"
                            type="password"
                            autoComplete="password"
                            required
                            minLength={15}
                            maxLength={128}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                        <br />
                        <small id="password-help">Use 15-128 characters.</small>
                  </p>
                  
                  
                    
                    

                    <p>
                        <label htmlFor="register-confirm">Confirm password</label>
                        <br />
                        <input
                            id="register-confirm"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={15}
                            maxLength={128}
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                        />
                    </p>

                    <button type="submit">
                        {pending ? "Creating account..." : "Create account"}
                    </button>
                </fieldset>

                {error && <p role="alert">{error}</p>}
                {success && <p role="status">{success}</p>}
            </form>
        </section>
    );

}