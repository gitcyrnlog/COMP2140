import type { User } from "../models/User";
import { api, ApiError } from "./ApiClient";

export async function currentUser(): Promise<User | null> {
    try {
        return (await api<{ user: User }>("/api/auth/me")).user;
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
    }
}

export async function login(email: string, password: string): Promise<User> {
    return (await api<{ user: User }>("/api/auth/login", { method: "POST", body: { email, password } })).user;
}

export async function logout(): Promise<void> {
    await api<void>("/api/auth/logout", { method: "POST" });
}
