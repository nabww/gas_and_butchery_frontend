import { useState } from "react";

export default function PayoutActionModal({ payout, onClose, onIssue, onUnfulfilled }) {
  const [processing, setProcessing] = useState("");
  if (!payout) return null;

  const runAction = async (action, handler) => {
    if (processing) return;
    setProcessing(action);
    try {
      await handler();
    } finally {
      setProcessing("");
    }
  };

  const title =
    payout.type === "cashback"
      ? `Cashback payout: KES ${Number(payout.cashback_amount || 0).toFixed(2)}`
      : `Reward payout: ${payout.reward_name || "a reward"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface1 text-textPrimary shadow-2xl border border-borderColor p-5">
        <h3 className="text-lg font-bold text-textPrimary">{title}</h3>
        <div className="mt-3 space-y-1 text-sm text-textSecondary">
          <p>
            <span className="font-semibold text-textPrimary">Customer:</span>{" "}
            {payout.customer_name || payout.customer_phone || "Unknown"}
          </p>
          {payout.type === "prize" && (
            <p>
              <span className="font-semibold text-textPrimary">KES value:</span>{" "}
              {Number(payout.cost_value || 0).toFixed(2)}
            </p>
          )}
          <p>
            <span className="font-semibold text-textPrimary">Won at:</span>{" "}
            {new Date(payout.created_at).toLocaleString("en-KE")}
          </p>
        </div>
        <p className="mt-4 text-sm text-textSecondary">
          Has this {payout.type === "cashback" ? "cashback" : "reward"} been
          issued to the customer?
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => runAction("issue", onIssue)}
            disabled={!!processing}
            aria-busy={processing === "issue"}
            className="w-full py-2.5 rounded-xl bg-primary text-onPrimary text-sm font-semibold hover:bg-primaryDark transition-colors disabled:opacity-50">
            {processing === "issue" ? "Processing…" : payout.type === "cashback" ? "Mark as paid" : "Mark as issued"}
          </button>
          <button
            type="button"
            onClick={() => runAction("unfulfilled", onUnfulfilled)}
            disabled={!!processing}
            aria-busy={processing === "unfulfilled"}
            className="w-full py-2.5 rounded-xl border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors disabled:opacity-50">
            {processing === "unfulfilled" ? "Processing…" : "Mark as unfulfilled"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={!!processing}
            className="w-full py-2.5 rounded-xl text-textSecondary text-sm font-semibold hover:bg-surface3 transition-colors disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
