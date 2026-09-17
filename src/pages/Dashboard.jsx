import { useEffect, useMemo, useState } from "react";
import { useActiveLocation } from "../contexts/LocationContext";
import {
  getSalesReport,
  getLoyaltyReport,
  getArAgingReport,
  getLedgerReport,
  getLowStockAlerts,
  getOversellFlags,
  getTopCustomersReport,
  listLocations,
  getDailyTrend,
  getPromoPayouts,
  markPromoPayoutPaid,
  markPromoPayoutUnfulfilled,
  getInventoryValue,
} from "../lib/api";
import PayoutActionModal from "../components/PayoutActionModal";

const formatKes = (amount) =>
  `KES ${Number(amount || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const localIsoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const rangeStart = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - (days - 1));
  return localIsoDate(date);
};

const previousPeriod = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const days = Math.round((end - start) / 86400000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (days - 1));
  return { start: localIsoDate(previousStart), end: localIsoDate(previousEnd) };
};

function TrendChart({ data, height = 200 }) {
  if (!data || data.length === 0) return null;
  const padding = { top: 10, right: 10, bottom: 30, left: 50 };
  const width = 800;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(1, ...data.map((d) => Math.max(d.revenue, d.expenses, d.net)));
  const minValue = Math.min(0, ...data.map((d) => Math.min(d.net, 0)));
  const range = maxValue - minValue;

  const xFor = (i) => padding.left + (i / (data.length - 1)) * chartWidth;
  const yFor = (v) => padding.top + chartHeight - ((v - minValue) / range) * chartHeight;

  const linePath = (key) =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d[key])}`)
      .join(" ");

  const yTicks = [0, maxValue * 0.5, maxValue];

  return (
    <div className="h-48 w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={yFor(t)}
            x2={width - padding.right}
            y2={yFor(t)}
            stroke="var(--border-color)"
            strokeDasharray="4"
          />
          <text x={padding.left - 8} y={yFor(t) + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10">
            {Math.round(t).toLocaleString()}
          </text>
        </g>
      ))}
      <path d={linePath("revenue")} fill="none" stroke="var(--text-success)" strokeWidth="2" />
      <path d={linePath("expenses")} fill="none" stroke="var(--text-danger)" strokeWidth="2" strokeDasharray="5,3" />
      <path d={linePath("net")} fill="none" stroke="var(--primary)" strokeWidth="2" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xFor(i)} cy={yFor(d.revenue)} r="3" fill="var(--text-success)" />
          <circle cx={xFor(i)} cy={yFor(d.expenses)} r="3" fill="var(--text-danger)" />
          <text x={xFor(i)} y={height - 6} textAnchor="middle" fill="var(--text-secondary)" fontSize="9">
            {d.day.slice(5)}
          </text>
        </g>
      ))}
      <text x={padding.left} y={14} textAnchor="start" fill="var(--text-success)" fontSize="10" fontWeight="bold">
        — Revenue
      </text>
      <text x={padding.left + 90} y={14} textAnchor="start" fill="var(--text-danger)" fontSize="10" fontWeight="bold">
        - - Expenses
      </text>
      <text x={padding.left + 190} y={14} textAnchor="start" fill="var(--primary)" fontSize="10" fontWeight="bold">
        — Net
      </text>
      </svg>
    </div>
  );
}

function KpiCard({ label, value, subtext, tone = "default" }) {
  const toneClasses = {
    default: "border-borderColor bg-surface2",
    success: "border-success/30 bg-success/5",
    danger: "border-danger/30 bg-danger/5",
  };
  const textTone = {
    default: "text-textPrimary",
    success: "text-success",
    danger: "text-danger",
  };
  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-textSecondary text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${textTone[tone]}`}>{value}</p>
      {subtext && <p className="text-textMuted text-xs mt-1">{subtext}</p>}
    </div>
  );
}

// Hero KPIs — the numbers the owner checks first. Larger type, denser card.
function HeroCard({ label, value, subtext, tone = "default" }) {
  const toneClasses = {
    default: "border-borderColor bg-surface2",
    success: "border-success/40 bg-success/5",
    danger: "border-danger/40 bg-danger/10",
  };
  const textTone = {
    default: "text-textPrimary",
    success: "text-success",
    danger: "text-danger",
  };
  return (
    <div className={`rounded-2xl border-2 p-5 ${toneClasses[tone]}`}>
      <p className="text-textSecondary text-xs font-semibold uppercase tracking-wider">{label}</p>
      <p className={`text-3xl sm:text-4xl font-bold mt-2 ${textTone[tone]}`}>{value}</p>
      {subtext && <p className="text-textSecondary text-xs mt-2">{subtext}</p>}
    </div>
  );
}

// A named KPI group. Cards flagged `zero` collapse into a single muted
// "nothing to report" line — zero-activity cards add scan fatigue without
// conveying information.
function KpiSection({ title, cards }) {
  const active = cards.filter((c) => !c.zero);
  const quiet = cards.filter((c) => c.zero);
  return (
    <section className="mb-6">
      <h2 className="text-textMuted text-xs font-bold uppercase tracking-wider mb-2">{title}</h2>
      {active.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {active.map((card) => (
            <KpiCard key={card.label} {...card} />
          ))}
        </div>
      )}
      {quiet.length > 0 && (
        <p className="text-textMuted text-xs mt-2">
          Nothing to report: {quiet.map((card) => card.label).join(" · ")}
        </p>
      )}
    </section>
  );
}

export default function Dashboard({ onNavigate }) {
  const { activeLocationId } = useActiveLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sales, setSales] = useState(null);
  const [prevSales, setPrevSales] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [ar, setAr] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [oversells, setOversells] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [trend, setTrend] = useState([]);
  const [pendingRewards, setPendingRewards] = useState([]);
  const [inventoryValue, setInventoryValue] = useState({ totalValue: 0 });
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [payoutError, setPayoutError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [startDate, setStartDate] = useState(() => localIsoDate());
  const [endDate, setEndDate] = useState(() => localIsoDate());

  const priorPeriod = useMemo(
    () => previousPeriod(startDate, endDate),
    [startDate, endDate],
  );
  const isToday = startDate === localIsoDate() && endDate === localIsoDate();
  const periodLabel = startDate === endDate ? startDate : `${startDate} to ${endDate}`;

  const activeLocationName = useMemo(() => {
    const loc = locations.find((l) => String(l.id) === String(activeLocationId));
    return loc?.name || (activeLocationId ? `Location ${activeLocationId}` : "All locations");
  }, [locations, activeLocationId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    async function load() {
      try {
        const [
          salesData,
          prevSalesData,
          loyaltyData,
          arData,
          ledgerData,
          lowStockData,
          oversellsData,
          topCustomersData,
          locationsData,
          trendData,
          pendingRewardsData,
          inventoryValueData,
        ] = await Promise.all([
          getSalesReport(startDate, endDate, activeLocationId).catch(() => null),
          getSalesReport(priorPeriod.start, priorPeriod.end, activeLocationId).catch(() => null),
          getLoyaltyReport(startDate, endDate).catch(() => null),
          getArAgingReport().catch(() => null),
          getLedgerReport(startDate, endDate, activeLocationId).catch(() => null),
          getLowStockAlerts(activeLocationId).catch(() => []),
          getOversellFlags(false, activeLocationId).catch(() => []),
          getTopCustomersReport(startDate, endDate, activeLocationId).catch(() => ({ customers: [] })),
          listLocations().catch(() => []),
          getDailyTrend(14, activeLocationId).catch(() => ({ points: [] })),
          // Not date-scoped on purpose -- a pending cashback/reward from a
          // few days ago is still owed to the customer today, so the owner
          // needs to see it here regardless of when it was won.
          getPromoPayouts(false, activeLocationId).catch(() => []),
          getInventoryValue(activeLocationId).catch(() => ({ totalValue: 0 })),
        ]);
        if (cancelled) return;
        setSales(salesData);
        setPrevSales(prevSalesData);
        setLoyalty(loyaltyData);
        setAr(arData);
        setLedger(ledgerData);
        setLowStock(lowStockData);
        setOversells(oversellsData);
        setTopCustomers(topCustomersData?.customers || []);
        setLocations(locationsData || []);
        setRecentSales((salesData?.sales || []).slice(0, 5));
        setTrend(trendData?.points || []);
        setPendingRewards(pendingRewardsData || []);
        setInventoryValue(inventoryValueData || { totalValue: 0 });
      } catch (err) {
        setError(err.message || "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, priorPeriod.start, priorPeriod.end, activeLocationId, refreshKey]);

  const handleIssuePayout = async () => {
    if (!selectedPayout) return;
    setPayoutError("");
    try {
      await markPromoPayoutPaid(selectedPayout.id);
      setSelectedPayout(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setPayoutError(err.message || "Failed to mark reward as fulfilled.");
    }
  };

  const handleUnfulfilledPayout = async () => {
    if (!selectedPayout) return;
    setPayoutError("");
    try {
      await markPromoPayoutUnfulfilled(selectedPayout.id);
      setSelectedPayout(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setPayoutError(err.message || "Failed to mark reward as unfulfilled.");
    }
  };

  const revenue = sales?.summary?.totalRevenue || 0;
  const cogs = sales?.summary?.totalCOGS || 0;
  const grossProfit = sales?.summary?.totalGrossProfit || 0;
  const transactions = sales?.summary?.totalSales || 0;
  const cash = sales?.summary?.byMethod?.cash || 0;
  const mpesa = sales?.summary?.byMethod?.mpesa || 0;
  const account = sales?.summary?.byMethod?.account || 0;
  const discounts = sales?.summary?.totalDiscount || 0;
  const pointRedemptions = sales?.summary?.totalRedemptions || 0;
  const pointRedemptionCount = sales?.summary?.redemptionCount || 0;
  const loyaltyLiability = loyalty?.dailyLiability || 0;
  const overdue = (ar?.buckets?.["1to30"] || 0) + (ar?.buckets?.["31to60"] || 0) + (ar?.buckets?.["over60"] || 0);
  const income = ledger?.income || {};
  const expenses = ledger?.expenses || {};
  const restockExpenses = Number(expenses?.stock || 0) + Number(expenses?.refills || 0);
  const operatingExpenses = Number(expenses?.operating || 0);
  // Credit sold this period that hasn't been collected yet -- shown as
  // negative since it's money extended, not money in hand.
  const creditBalance = -(income?.creditExtended || 0);
  // Unpaid credit = outstanding invoice balances (AR), not period-scoped:
  // a settled invoice must drop this figure to zero even if the sale was
  // made in the selected period.
  const unpaidCredit = Number(ar?.totalOutstanding || 0);
  const totalIncome = ledger?.netIncome || 0;
  // Backlog, not a daily flow figure -- a pending payout from days ago is
  // still outstanding today, so this is derived from the full pending list
  // (same data backing the "Pending rewards & cashback" section below)
  // rather than the date-scoped ledger totals, which would silently drop
  // anything not won today.
  const pendingPromo = pendingRewards.reduce(
    (sum, p) => sum + Number(p.cashback_amount || p.cost_value || 0),
    0,
  );
  const pendingPromoCount = pendingRewards.length;
  // Combines catalog reward redemptions with promo prize/cashback wins that
  // were marked paid/issued today -- previously only counted the catalog
  // table, so a prize or cashback actually handed to a customer today could
  // silently be missing from this figure.
  const redemptions = expenses?.rewardsIssued || 0;
  const redemptionCount = expenses?.rewardsIssuedCount || 0;
  const prevRevenue = prevSales?.summary?.totalRevenue || 0;
  const revenueChange = prevRevenue === 0 ? 0 : ((revenue - prevRevenue) / prevRevenue) * 100;
  const marginPct = (sales?.summary?.grossProfitMargin || 0) * 100;
  // Red means "needs attention" only — oversells, low stock, unpaid credit,
  // money owed to customers (promo payouts) and overdue corporate invoices.
  const flagCount =
    oversells.length +
    lowStock.length +
    (unpaidCredit > 0 ? 1 : 0) +
    (pendingPromoCount > 0 ? 1 : 0) +
    (overdue > 0 ? 1 : 0);
  const flagDetail = [
    oversells.length && `${oversells.length} oversell(s)`,
    lowStock.length && `${lowStock.length} low stock`,
    unpaidCredit > 0 && "unpaid credit",
    pendingPromoCount > 0 && `${pendingPromoCount} promo payout(s)`,
    overdue > 0 && "overdue invoices",
  ].filter(Boolean).join(" · ");
  const discountsHigh = revenue > 0 && discounts > revenue * 0.15;

  const narratives = useMemo(() => {
    const items = [];
    if (revenue > 0 && prevRevenue > 0) {
      const direction = revenue >= prevRevenue ? "up" : "down";
      items.push(`Revenue is ${direction} ${Math.abs(revenueChange).toFixed(1)}% from the previous equivalent period (${formatKes(prevRevenue)}).`);
    } else if (revenue > 0 && prevRevenue === 0) {
      items.push("The selected period has revenue while the previous equivalent period had none.");
    } else if (revenue === 0 && prevRevenue > 0) {
      items.push("No revenue was recorded in the selected period, though the previous equivalent period had sales.");
    }
    if (lowStock.length > 0) {
      items.push(`${lowStock.length} item(s) at or below their low-stock threshold — consider restocking.`);
    }
    if (oversells.length > 0) {
      items.push(`${oversells.length} unresolved oversell(s) need admin review and stock correction.`);
    }
    if (overdue > 0) {
      items.push(`${formatKes(overdue)} of corporate invoices is overdue.`);
    }
    if (pendingPromoCount > 0) {
      items.push(`${pendingPromoCount} promo payout(s) totaling ${formatKes(pendingPromo)} are still pending.`);
    }
    if (discounts > revenue * 0.15) {
      items.push(
        "Manual and approved discounts in the selected period exceed 15% of revenue — review discount patterns.",
      );
    }
    if (mpesa > 0 && mpesa + cash + account === 0) {
      // unreachable, but kept for safety
    } else if (account > revenue * 0.5) {
      items.push("Account / corporate sales make up more than half of today's revenue.");
    }
    return items;
  }, [revenue, prevRevenue, revenueChange, lowStock.length, oversells.length, overdue, pendingPromo, pendingPromoCount, discounts, mpesa, cash, account]);

  if (loading) {
    return (
      <main className="p-3 sm:p-6 max-w-6xl mx-auto">
        <p className="text-textSecondary">Loading dashboard…</p>
      </main>
    );
  }

  return (
    <main className="p-3 sm:p-6 max-w-6xl mx-auto">
      <header className="mb-6 space-y-4">
        <div>
          <h1 className="text-textPrimary text-2xl font-bold">Dashboard</h1>
          <p className="text-textSecondary text-sm mt-1">
            Snapshot for {periodLabel}
            {activeLocationName ? ` · ${activeLocationName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-textMuted mb-1">From</label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="px-3 py-2 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-textMuted mb-1">To</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={localIsoDate()}
              onChange={(event) => setEndDate(event.target.value)}
              className="px-3 py-2 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm"
            />
          </div>
          {[
            ["Today", 1],
            ["7 days", 7],
            ["30 days", 30],
          ].map(([label, days]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setStartDate(rangeStart(days));
                setEndDate(localIsoDate());
              }}
              className="px-3 py-2 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:text-textPrimary hover:bg-surface3">
              {label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-danger/10 text-danger text-sm">{error}</div>
      )}

      {!activeLocationId && (
        <div className="mb-4 p-3 rounded-xl bg-warning/10 text-warning text-sm">
          You are viewing data for <strong>all locations</strong>. This view is read-only — select a shop to record sales, expenses, or transfers.
        </div>
      )}

      {(narratives.length > 0 || trend.length > 0) && (
        <section className="rounded-2xl bg-surface2 border border-borderColor p-5 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-textPrimary font-bold">14-day trend</h2>
            <span
              onClick={() => onNavigate && onNavigate("/insights")}
              className="text-primary text-sm underline cursor-pointer hover:text-primary-dark"
              tabIndex={0}
              role="button"
              onKeyDown={(e) => e.key === "Enter" && onNavigate && onNavigate("/insights")}
            >
              View more
            </span>
          </div>
          {narratives.length > 0 && (
            <ul className="space-y-2 mb-5">
              {narratives.map((n, i) => (
                <li key={i} className="text-sm text-textPrimary flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
          {trend.length > 0 && <TrendChart data={trend} />}
        </section>
      )}

      {/* Hero row — the four numbers the owner checks first. */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <HeroCard
          label="Sales"
          value={formatKes(revenue)}
          subtext={`${transactions} transactions${prevRevenue > 0 ? ` · ${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}% vs previous period` : ""}`}
        />
        <HeroCard
          label="Gross margin"
          value={`${marginPct.toFixed(1)}%`}
          subtext={`${formatKes(grossProfit)} gross profit`}
          tone={grossProfit > 0 ? "success" : grossProfit < 0 ? "danger" : "default"}
        />
        <HeroCard
          label="Net cash"
          value={formatKes(totalIncome)}
          subtext="Collected income less recorded costs for this period"
          tone={totalIncome > 0 ? "success" : totalIncome < 0 ? "danger" : "default"}
        />
        <HeroCard
          label="Needs attention"
          value={flagCount === 0 ? "All clear" : flagCount}
          subtext={flagCount === 0 ? "No flagged items right now" : flagDetail}
          tone={flagCount > 0 ? "danger" : "success"}
        />
      </section>

      <KpiSection
        title="Sales & Cash"
        cards={[
          { label: "Cash", value: formatKes(cash) },
          { label: "M-Pesa", value: formatKes(mpesa) },
          { label: "Account / credit sales", value: formatKes(account) },
          {
            label: "Unpaid credit",
            value: formatKes(unpaidCredit),
            subtext: `${income?.creditExtendedCount || 0} credit sale(s) in the selected period`,
            tone: unpaidCredit > 0 ? "danger" : "default",
            zero: unpaidCredit <= 0,
          },
          { label: "Top customer in period", value: formatKes(topCustomers[0]?.total_spend || 0), subtext: topCustomers[0]?.name || "No sales yet", zero: !topCustomers[0] },
        ]}
      />

      <KpiSection
        title="Profitability"
        cards={[
          { label: "COGS", value: formatKes(cogs), subtext: "Cost of goods sold in selected period" },
          {
            label: "Gross profit",
            value: formatKes(grossProfit),
            subtext: "Revenue less cost of goods sold",
            tone: grossProfit > 0 ? "success" : grossProfit < 0 ? "danger" : "default",
          },
          { label: "Operating expenses", value: formatKes(operatingExpenses), subtext: "Transport, utilities, wages and other costs", zero: operatingExpenses <= 0 },
          { label: "All expenses", value: formatKes(expenses?.total || 0), subtext: "Restocks, operating costs, promotions and rewards", zero: Number(expenses?.total || 0) <= 0 },
          { label: "Recorded expense entries", value: expenses?.postedCount || 0, subtext: isToday ? "Posted today" : "Posted in selected period", zero: !expenses?.postedCount },
        ]}
      />

      <KpiSection
        title="Inventory"
        cards={[
          { label: "Inventory value", value: formatKes(inventoryValue?.totalValue), subtext: "Current stock value at landed cost" },
          {
            label: "Restock expenses",
            value: formatKes(restockExpenses),
            subtext: `${formatKes(expenses?.stock || 0)} inventory · ${formatKes(expenses?.refills || 0)} gas refills`,
            zero: restockExpenses <= 0,
          },
          { label: "Low-stock items", value: lowStock.length, tone: lowStock.length > 0 ? "danger" : "default", zero: lowStock.length === 0 },
          { label: "Unresolved oversells", value: oversells.length, tone: oversells.length > 0 ? "danger" : "default", zero: oversells.length === 0 },
        ]}
      />

      <KpiSection
        title="Loyalty & Promotions"
        cards={[
          {
            label: "Discounts",
            value: formatKes(discounts),
            subtext: "Manual and approved discounts",
            tone: discountsHigh ? "danger" : "default",
            zero: discounts <= 0,
          },
          { label: "Points redemptions", value: formatKes(pointRedemptions), subtext: `${pointRedemptionCount} redemptions at checkout`, zero: pointRedemptions <= 0 },
          { label: "Period loyalty liability", value: formatKes(loyaltyLiability), subtext: "Net new points value earned in the selected period", zero: loyaltyLiability <= 0 },
          {
            label: "Pending promo payouts",
            value: formatKes(pendingPromo),
            subtext: `${pendingPromoCount} pending`,
            tone: pendingPromoCount > 0 ? "danger" : "default",
            zero: pendingPromoCount === 0,
          },
          { label: "Reward redemptions", value: formatKes(redemptions), subtext: `${redemptionCount} redemptions`, zero: redemptions <= 0 },
        ]}
      />

      {recentSales.length > 0 && (
        <section className="rounded-2xl bg-surface2 border border-borderColor p-5 mb-6">
          <h2 className="text-textPrimary font-bold mb-4">Recent transactions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-textSecondary border-b border-borderColor">
                  <th className="pb-2 pr-3">ID</th>
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3">Method</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="text-textPrimary">
                {recentSales.map((sale) => (
                  <tr key={sale.id} className="border-b border-borderColor/50 last:border-0">
                    <td className="py-2 pr-3 font-mono">{sale.local_id || sale.id}</td>
                    <td className="py-2 pr-3">{new Date(sale.created_at).toLocaleTimeString("en-KE")}</td>
                    <td className="py-2 pr-3">{sale.customer_name || "Walk-in"}</td>
                    <td className="py-2 pr-3 capitalize">{sale.payment_method || "—"}</td>
                    <td className="py-2 text-right font-semibold">{formatKes(sale.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(lowStock.length > 0 || oversells.length > 0) && (
        <section className="rounded-2xl bg-surface2 border border-borderColor p-5">
          <h2 className="text-textPrimary font-bold mb-4">Alerts</h2>
          {lowStock.length > 0 && (
            <div className="mb-4">
              <p className="text-textSecondary text-xs uppercase tracking-wide mb-2">Low stock</p>
              <div className="space-y-1">
                {lowStock.slice(0, 5).map((item) => (
                  <div key={item.cylinder_brand_id} className="text-sm text-textPrimary">
                    {item.brand} {item.weight_kg}kg — {item.filled_qty} filled (threshold {item.low_stock_threshold})
                  </div>
                ))}
              </div>
            </div>
          )}
          {oversells.length > 0 && (
            <div>
              <p className="text-textSecondary text-xs uppercase tracking-wide mb-2">Unresolved oversells</p>
              <div className="space-y-1">
                {oversells.slice(0, 5).map((flag) => (
                  <div key={flag.id} className="text-sm text-textPrimary">
                    {flag.display_name || flag.item_name || flag.item_type} — requested {flag.requested} / available {flag.available}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {activeLocationId && (pendingRewards.length > 0 || payoutError) && (
      <section className="rounded-2xl bg-surface2 border border-borderColor p-5 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-textPrimary font-bold">
            Pending rewards & cashback{activeLocationId ? ` — ${activeLocationName}` : ""}
          </h2>
          <span className="text-textSecondary text-xs">
            {pendingRewards.length} awaiting action
          </span>
        </div>
        {payoutError && (
          <p className="mb-3 p-2 rounded-lg bg-danger/10 text-danger text-xs">{payoutError}</p>
        )}
        <div className="space-y-2">
            {pendingRewards.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPayout(p)}
                className="w-full p-3 rounded-xl bg-surface1 border border-borderColor flex justify-between items-center text-sm text-left hover:border-borderStrong hover:bg-surface3 transition-all"
              >
                <span className="text-textPrimary">
                  {p.customer_name || p.customer_phone || "Customer"} —{" "}
                  {p.type === "cashback"
                    ? `Cashback KES ${Number(p.cashback_amount || 0).toFixed(2)}`
                    : p.reward_name || "Reward"}{" "}
                  {p.type === "prize" && `(KES ${Number(p.cost_value || 0).toFixed(2)})`}
                  <span className="text-textSecondary text-xs ml-2">
                    {p.location_name || "Unknown branch"} ·{" "}
                    {new Date(p.created_at).toLocaleDateString("en-KE")}
                  </span>
                </span>
                <span className="text-textSecondary text-xs">Action</span>
              </button>
            ))}
        </div>
      </section>
      )}

      <PayoutActionModal
        payout={selectedPayout}
        onClose={() => setSelectedPayout(null)}
        onIssue={handleIssuePayout}
        onUnfulfilled={handleUnfulfilledPayout}
      />
    </main>
  );
}
