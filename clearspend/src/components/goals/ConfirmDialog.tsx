import { useEffect, useRef } from "react";

interface Props {
    title: string;
    message: string;
    confirmLabel: string;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/** Modal confirmation (AC-2.4). Cancel, Escape or clicking outside leaves everything unchanged. */
export default function ConfirmDialog({ title, message, confirmLabel, busy, onConfirm, onCancel }: Props) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = ref.current;
        if (dialog && !dialog.open) dialog.showModal();
    }, []);

    return (
        <dialog
            ref={ref}
            className="goal-dialog"
            aria-labelledby="confirm-title"
            onCancel={(event) => {
                event.preventDefault();
                onCancel();
            }}
        >
            <h3 id="confirm-title">{title}</h3>
            <p>{message}</p>
            <div className="goal-actions">
                <button type="button" onClick={onCancel} disabled={busy}>
                    Cancel
                </button>
                <button type="button" className="goal-danger" onClick={onConfirm} disabled={busy}>
                    {busy ? "Working..." : confirmLabel}
                </button>
            </div>
        </dialog>
    );
}
