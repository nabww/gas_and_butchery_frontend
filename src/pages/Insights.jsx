import { useEffect, useMemo, useState } from "react";
import { useActiveLocation } from "../contexts/LocationContext";
import { getInsights } from "../lib/api";

const statusBadge = (status) => {
  const map = {
    urgent: { text: "Urgent", cls: "bg-danger/10 text-danger" },
    soon: { text: "Soon", cls: "bg-warning/10 text-warning" },
    low_stock: { text: "Low stock", cls: "bg-warning/10 text-warning" },
    stable: { text: "OK", cls: "bg-success/10 text-success" },
    no_sales: { text: "No recent sales", cls: "bg-surface3 text-textSecondary" },
  };
  const s = map[status] || map.no_sales;
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.text}</span>;
};

export default function Insights({ onNavigate }) {
  const { activeLocationId } = useActiveLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [atRisk, setAtRisk] = useState([]);
  const [restock, setRestock] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getInsights(activeLocationId)
      .then((data) => {
        if (cancelled) return;
        setAtRisk(data.atRiskCustomers || []);
        setRestock(data.restockPredictions || []);
      })
      .catch((err) => setError(err.message || "Failed to load insights."))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeLocationId]);

  const urgentRestock = useMemo(() => restock.filter((r) => r.status === "urgent" || r.status === "low_stock"), [restock]);
  const soonRestock = useMemo(() => restock.filter((r) => r.status === "soon"), [restock]);

  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <p className="text-textSecondary">Loading insights…</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          {onNavigate && (
            <span
              onClick={() => onNavigate('/dashboard')}
              className="text-sm text-primary underline cursor-pointer hover:text-primary-dark"
              tabIndex={0}
              role="button"
              onKeyDown={(e) => e.key === "Enter" && onNavigate('/dashboard')}
            >
              ← Back to dashboard
            </span>
          )}
        </div>
        <h1 className="text-textPrimary text-2xl font-bold">Insights</h1>
        {/* <p className="text-textSecondary text-sm mt-1">
          Rule-based signals for the active shop.
        </p> */}
      </header>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-danger/10 text-danger text-sm">{error}</div>
      )}

      <section className="rounded-2xl bg-surface2 border border-borderColor p-5 mb-6">
        <h2 className="text-textPrimary font-bold mb-4">
          At-risk customers
          <span className="ml-2 text-sm font-normal text-textSecondary">
            ({atRisk.length} with no purchase in 30+ days)
          </span>
        </h2>
        {atRisk.length === 0 ? (
          <p className="text-textSecondary text-sm">No at-risk customers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-textSecondary border-b border-borderColor">
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3">Phone</th>
                  <th className="pb-2 pr-3">Last purchase</th>
                  <th className="pb-2 pr-3 text-right">Days since</th>
                  <th className="pb-2 text-right">Lifetime sales</th>
                </tr>
              </thead>
              <tbody className="text-textPrimary">
                {atRisk.map((c) => (
                  <tr key={c.id} className="border-b border-borderColor/50 last:border-0">
                    <td className="py-2 pr-3 font-semibold">{c.name}</td>
                    <td className="py-2 pr-3">{c.phone || "—"}</td>
                    <td className="py-2 pr-3">{new Date(c.last_purchase_at).toLocaleDateString("en-KE")}</td>
                    <td className="py-2 pr-3 text-right">{c.days_since}</td>
                    <td className="py-2 text-right">{c.lifetime_sales}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-surface2 border border-borderColor p-5 mb-6">
        <h2 className="text-textPrimary font-bold mb-4">Restock predictions</h2>

        {urgentRestock.length > 0 && (
          <div className="mb-5">
            <p className="text-textSecondary text-xs uppercase tracking-wide mb-2">Urgent or low stock</p>
            <div className="space-y-2">
              {urgentRestock.slice(0, 10).map((r) => (
                <div key={`${r.id}-${r.location_id}`} className="flex justify-between items-center text-sm">
                  <span className="text-textPrimary">
                    {r.brand} {r.weight_kg}kg — {r.filled_qty} filled
                  </span>
                  {statusBadge(r.status)}
                </div>
              ))}
            </div>
          </div>
        )}

        {soonRestock.length > 0 && (
          <div className="mb-5">
            <p className="text-textSecondary text-xs uppercase tracking-wide mb-2">Restock soon</p>
            <div className="space-y-2">
              {soonRestock.slice(0, 10).map((r) => (
                <div key={`${r.id}-${r.location_id}`} className="flex justify-between items-center text-sm">
                  <span className="text-textPrimary">
                    {r.brand} {r.weight_kg}kg — ~{r.days_until_stockout} days left
                  </span>
                  {statusBadge(r.status)}
                </div>
              ))}
            </div>
          </div>
        )}

        {restock.length === 0 ? (
          <p className="text-textSecondary text-sm">No stock data found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-textSecondary border-b border-borderColor">
                  <th className="pb-2 pr-3">Brand</th>
                  <th className="pb-2 pr-3 text-right">Filled</th>
                  <th className="pb-2 pr-3 text-right">Sold (30d)</th>
                  <th className="pb-2 pr-3 text-right">Daily rate</th>
                  <th className="pb-2 pr-3 text-right">Days left</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="text-textPrimary">
                {restock.map((r) => (
                  <tr key={`${r.id}-${r.location_id}`} className="border-b border-borderColor/50 last:border-0">
                    <td className="py-2 pr-3">{r.brand} {r.weight_kg}kg</td>
                    <td className="py-2 pr-3 text-right">{r.filled_qty}</td>
                    <td className="py-2 pr-3 text-right">{r.sold_30_days}</td>
                    <td className="py-2 pr-3 text-right">{r.daily_rate}</td>
                    <td className="py-2 pr-3 text-right">{r.days_until_stockout ?? "—"}</td>
                    <td className="py-2">{statusBadge(r.status)}</td>
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
