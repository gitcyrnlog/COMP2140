// Frontend service for FR1 Goal Management: talks to /api/goals and /api/notifications.
import type { AppNotification, Goal, GoalInput, SortField, SortOrder } from "../models/Goal";
import { api } from "./ApiClient";

export async function listGoals(sort: SortField, order: SortOrder): Promise<Goal[]> {
    return (await api<{ goals: Goal[] }>(`/api/goals?sort=${sort}&order=${order}`)).goals;
}

export async function createGoal(input: GoalInput): Promise<Goal> {
    return (await api<{ goal: Goal }>("/api/goals", { method: "POST", body: input })).goal;
}

export async function updateGoal(id: string, changes: Partial<GoalInput>, confirmDecrease = false): Promise<Goal> {
    const body = confirmDecrease ? { ...changes, confirmDecrease: true } : changes;
    return (await api<{ goal: Goal }>(`/api/goals/${id}`, { method: "PATCH", body })).goal;
}

export async function deleteGoal(id: string): Promise<void> {
    // The user has already confirmed in the dialog, so confirm=true is sent.
    await api<void>(`/api/goals/${id}?confirm=true`, { method: "DELETE" });
}

export async function addContribution(id: string, amount: number): Promise<Goal> {
    return (await api<{ goal: Goal }>(`/api/goals/${id}/contributions`, { method: "POST", body: { amount } })).goal;
}

export async function unreadNotifications(): Promise<AppNotification[]> {
    return (await api<{ notifications: AppNotification[] }>("/api/notifications?unread=true")).notifications;
}

export async function markNotificationRead(id: string): Promise<void> {
    await api<void>(`/api/notifications/${id}/read`, { method: "POST" });
}
