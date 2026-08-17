import { useEffect, useState } from "react";
import { getOverridesReport } from "../lib/api";

export default function Overrides() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getOverridesReport()
      .then((report) => {
        if (!cancelled) setData(report);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load overrides.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const creditRows = data?.creditOverrides || [];
  const payoutRows = data?.pendingPayouts || [];

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-textPrimary">Overrides & approvals</h1>
      <p className="text-textSecondary text-sm">
        Credit-limit overrides and pending promotional payouts that need attention.
      </p>

      {error && (
        <p className="p-3 rounded-xl bg-danger/10 text-danger text-sm">{error}</p>
      )}

      {loading && <p className="text-textMuted text-sm">Loading...</p>}

      <section className="p-4 rounded-2xl bg-surface1 border border-borderColor space-y-3">
        <h2 className="text-lg font-bold text-textPrimary">
          Credit-limit overrides ({creditRows.length})
        </h2>
        {creditRows.length === 0 && !loading && (
          <p className="text-textMuted text-sm">No credit-limit overrides on record.</p>
        )}
        {creditRows.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-borderColor">
            <table className="w-full text-sm">
              <thead className="bg-surface2 text-textSecondary">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Branch</th>
                  <th className="p-3 text-left">Customer</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Discount</th>
                  <th className="p-3 text-left">Approver</th>
                </tr>
              </thead>
              <tbody>
                {creditRows.map((row) => (
                  <tr key={row.id} className="border-t border-borderColor text-textPrimary">
                    <td className="p-3">{new Date(row.created_at).toLocaleString("en-KE")}</td>
                    <td className="p-3">{row.location_name || "—"}</td>
                    <td className="p-3">{row.customer_name || row.customer_phone || "—"}</td>
                    <td className="p-3 text-right">KES {Number(row.total || 0).toFixed(2)}</td>
                    <td className="p-3 text-right">KES {Number(row.discount_amount || 0).toFixed(2)}</td>
                    <td className="p-3">{row.approver_name} ({row.approver_role})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="p-4 rounded-2xl bg-surface1 border border-borderColor space-y-3">
        <h2 className="text-lg font-bold text-textPrimary">
          Pending promo payouts ({payoutRows.length})
        </h2>
        {payoutRows.length === 0 && !loading && (
          <p className="text-textMuted text-sm">No pending promo payouts.</p>
        )}
        {payoutRows.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-borderColor">
            <table className="w-full text-sm">
              <thead className="bg-surface2 text-textSecondary">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Branch</th>
                  <th className="p-3 text-left">Customer</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {payoutRows.map((row) => (
                  <tr key={row.id} className="border-t border-borderColor text-textPrimary">
                    <td className="p-3">{new Date(row.created_at).toLocaleString("en-KE")}</td>
                    <td className="p-3">{row.location_name || "—"}</td>
                    <td className="p-3">{row.customer_name || row.customer_phone || "—"}</td>
                    <td className="p-3 capitalize">{row.type}</td>
                    <td className="p-3 text-right">
                      KES {Number(row.cashback_amount || row.cost_value || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
