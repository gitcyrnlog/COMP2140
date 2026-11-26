import { z } from "zod";
import { hasValidPrecision, MAX_AMOUNT_CENTS } from "../utility/financialCalc.js";

export const monthSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/, "Choose a valid month.");
export const budgetInputSchema = z.object({
    category: z.string().trim().min(1, "Enter a category.").max(60),
    month: monthSchema,
    limit: z.number().positive("Enter a limit greater than zero.")
        .max(MAX_AMOUNT_CENTS / 100)
        .refine(hasValidPrecision, "Use at most two decimal places."),
}).strict();

export type BudgetInput = z.infer<typeof budgetInputSchema>;
