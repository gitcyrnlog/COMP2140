const jmd = new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD", minimumFractionDigits: 2 });

export function formatJmd(amount: number): string {
    return jmd.format(amount);
}

export function formatDate(iso: string): string {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year!, month! - 1, day).toLocaleDateString("en-JM", { year: "numeric", month: "short", day: "numeric" });
}

/** Tomorrow's date as YYYY-MM-DD, used as the earliest selectable target date. */
export function tomorrow(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
