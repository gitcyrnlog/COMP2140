// Small fetch wrapper shared by the services. Always sends the session cookie and parses JSON errors.
export class ApiError extends Error {
    status: number;
    body: Record<string, unknown> | null;

    constructor(status: number, message: string, body: Record<string, unknown> | null) {
        super(message);
        this.status = status;
        this.body = body;
    }

    /** Field-level messages from the server, e.g. { targetDate: "Target date must be a future date." } */
    get fieldErrors(): Record<string, string> {
        const errors = this.body?.errors;
        return errors && typeof errors === "object" ? (errors as Record<string, string>) : {};
    }

    /** True when the server wants the user to confirm a delete or a decrease before it proceeds. */
    get requiresConfirmation(): boolean {
        return this.status === 409 && this.body?.requiresConfirmation === true;
    }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    let response: Response;
    try {
        response = await fetch(path, {
            method: init.method ?? "GET",
            credentials: "same-origin",
            headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
        });
    } catch {
        throw new ApiError(0, "Cannot reach the server. Check your connection and try again.", null);
    }
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
        const message = typeof data?.message === "string" ? data.message : "Something went wrong. Please try again.";
        throw new ApiError(response.status, message, data);
    }
    return data as T;
}
