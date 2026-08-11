export default function PayoutActionModal({ payout, onClose, onIssue, onUnfulfilled }) {
  if (!payout) return null;

  const title =
    payout.type === "cashback"
      ? `Cashback payout — KES ${Number(payout.cashback_amount || 0).toFixed(2)}`
      : `Reward payout — ${payout.reward_name || "a reward"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white text-slate-900 shadow-2xl border border-slate-200 p-5">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <div className="mt-3 space-y-1 text-sm text-slate-600">
          <p>
            <span className="font-semibold">Customer:</span>{" "}
            {payout.customer_name || payout.customer_phone || "Unknown"}
          </p>
          {payout.type === "prize" && (
            <p>
              <span className="font-semibold">KES value:</span>{" "}
              {Number(payout.cost_value || 0).toFixed(2)}
            </p>
          )}
          <p>
            <span className="font-semibold">Won at:</span>{" "}
            {new Date(payout.created_at).toLocaleString("en-KE")}
          </p>
        </div>
        <p className="mt-4 text-sm text-slate-700">
          Has this {payout.type === "cashback" ? "cashback" : "reward"} been
          issued to the customer?
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onIssue}
            className="w-full py-2.5 rounded-xl bg-primary text-onPrimary text-sm font-semibold hover:bg-primaryDark transition-colors">
            {payout.type === "cashback" ? "Mark as paid" : "Mark as issued"}
          </button>
          <button
            type="button"
            onClick={onUnfulfilled}
            className="w-full py-2.5 rounded-xl border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors">
            Mark as unfulfilled
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-textSecondary text-sm font-semibold hover:bg-surface3 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
