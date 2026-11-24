// Input validation for FR1 Goal Management (SRS acceptance criteria AC-2.1 and AC-2.4).
import { z } from "zod";
import { isValidIsoDate } from "../utility/dates.js";
import { hasValidPrecision, MAX_AMOUNT_CENTS } from "../utility/financialCalc.js";

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

const nameField = z
    .string({ error: "Enter a goal name." })
    .trim()
    .min(1, "Enter a goal name.")
    .max(60, "Goal name must be 60 characters or fewer.");

const targetAmountField = z
    .number({ error: "Enter the target amount as a number." })
    .refine((n) => Number.isFinite(n) && n > 0, "Target amount must be greater than JMD $0.00.")
    .refine((n) => Math.round(n * 100) <= MAX_AMOUNT_CENTS, "Target amount is too large.")
    .refine(hasValidPrecision, "Target amount can have at most 2 decimal places.");

const targetDateField = z
    .string({ error: "Enter a target date." })
    .refine(isValidIsoDate, "Enter the target date as a valid date.");

const priorityField = z.enum(PRIORITIES, { error: "Priority must be high, medium or low." });

export const createGoalSchema = z
    .object({
        name: nameField,
        targetAmount: targetAmountField,
        targetDate: targetDateField,
        priority: priorityField.optional(),
    })
    .strict();

export const updateGoalSchema = z
    .object({
        name: nameField.optional(),
        targetAmount: targetAmountField.optional(),
        targetDate: targetDateField.optional(),
        priority: priorityField.optional(),
        confirmDecrease: z.boolean().optional(),
    })
    .strict()
    .refine(
        (v) => v.name !== undefined || v.targetAmount !== undefined || v.targetDate !== undefined || v.priority !== undefined,
        { message: "Change at least one field to update the goal." },
    );

export const contributionSchema = z
    .object({
        amount: z
            .number({ error: "Enter the contribution amount as a number." })
            .refine((n) => Number.isFinite(n) && n > 0, "Contribution must be greater than JMD $0.00.")
            .refine((n) => Math.round(n * 100) <= MAX_AMOUNT_CENTS, "Contribution is too large.")
            .refine(hasValidPrecision, "Contribution can have at most 2 decimal places."),
    })
    .strict();

export const SORT_FIELDS = ["priority", "targetDate", "targetAmount"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

/** Turns a zod error into { field: first message } so the form can show clear errors. */
export function fieldErrors(error: z.ZodError): { message: string; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    for (const issue of error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!(key in errors)) errors[key] = issue.message;
    }
    const first = error.issues[0]?.message ?? "Invalid request.";
    return { message: first, errors };
}
