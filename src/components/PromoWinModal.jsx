import { useMemo, useState } from "react";

const formatKes = (amount) =>
  `KES ${Number(amount || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function PromoWinModal({ wins, customerName, onClose, onConfirm }) {
  const [decisions, setDecisions] = useState(() => {
    const map = {};
    wins.forEach((win) => (map[win.id] = null));
    return map;
  });
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const hasIssued = useMemo(
    () => Object.values(decisions).some((d) => d === "issued"),
    [decisions],
  );
  const allDecided = useMemo(
    () => Object.values(decisions).every((d) => d !== null),
    [decisions],
  );
  const canConfirm = allDecided && (!hasIssued || pin.length === 6);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setError("");
    setLoading(true);
    try {
      await onConfirm(decisions, hasIssued ? pin : null);
    } catch (err) {
      setError(err.message || "Could not process promo decision.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white text-slate-900 shadow-2xl border border-slate-200 p-5">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-lg font-bold text-slate-900">
            Congratulations {customerName || "Customer"}!
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            This sale has {wins.length} promo win{wins.length > 1 ? "s" : ""}.
          </p>
        </div>

        <div className="space-y-3 mb-4">
          {wins.map((win) => (
            <div
              key={win.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-sm text-slate-900">
                {win.type === "cashback"
                  ? `Cashback: ${formatKes(win.cashback_amount)}`
                  : `Prize: ${win.reward?.name || "a reward"}`}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDecisions((d) => ({ ...d, [win.id]: "issued" }))
                  }
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    decisions[win.id] === "issued"
                      ? "bg-primary text-onPrimary border-primary"
                      : "bg-white text-textSecondary border-borderColor hover:bg-surface3"
                  }`}>
                  Issue now
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDecisions((d) => ({ ...d, [win.id]: "pending" }))
                  }
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    decisions[win.id] === "pending"
                      ? "bg-warning text-white border-warning"
                      : "bg-white text-textSecondary border-borderColor hover:bg-surface3"
                  }`}>
                  Leave pending
                </button>
              </div>
            </div>
          ))}
        </div>

        {hasIssued && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Supervisor / admin PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter 6-digit PIN"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-primary text-sm"
            />
          </div>
        )}

        {error && (
          <p className="mb-3 p-2 rounded-lg bg-danger/10 text-danger text-xs font-semibold">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className="w-full py-2.5 rounded-xl bg-primary text-onPrimary text-sm font-semibold hover:bg-primaryDark transition-colors disabled:opacity-50">
            {loading ? "Processing..." : "Confirm"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full py-2.5 rounded-xl border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors disabled:opacity-50">
            Leave all pending
          </button>
        </div>
      </div>
    </div>
  );
}
