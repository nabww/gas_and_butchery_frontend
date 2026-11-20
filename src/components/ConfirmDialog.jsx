import { useEffect, useRef } from "react";

// In-app replacement for window.confirm: browser dialogs block the whole
// till, look foreign, and can be suppressed by the browser entirely.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title">
      <div className="w-full max-w-sm rounded-2xl bg-surface1 text-textPrimary shadow-2xl border border-borderColor p-5">
        <h3 id="confirm-dialog-title" className="text-lg font-bold text-textPrimary">
          {title}
        </h3>
        {message && <p className="mt-2 text-sm text-textSecondary">{message}</p>}
        <div className="mt-5 flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 min-h-[44px] rounded-xl border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors disabled:opacity-50">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className={`flex-1 min-h-[44px] rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
              danger ? "bg-danger text-white hover:opacity-90" : "bg-primary text-onPrimary hover:bg-primaryDark"
            }`}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
