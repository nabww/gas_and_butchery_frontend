import { useEffect, useMemo, useState } from "react";
import { useActiveLocation } from "../contexts/LocationContext";
import {
  getPromoPayouts,
  listCorporateAccounts,
  getLowStockAlerts,
  getOversellFlags,
  getSalesReport,
  getLoyaltyReport,
  getCustomersReport,
  getSyncReport,
  getLedgerReport,
  getTopCustomersReport,
  getArAgingReport,
} from "../lib/api";

const TABS = [
  { id: "promotions", label: "Promotions" },
  { id: "corporate", label: "Corporate" },
  { id: "ar-aging", label: "AR aging" },
  { id: "inventory", label: "Inventory" },
  { id: "sales", label: "Sales" },
  { id: "top-customers", label: "Top customers" },
  { id: "ledger", label: "Ledger" },
  { id: "loyalty", label: "Loyalty" },
  { id: "customers", label: "Customers" },
  { id: "sync", label: "Sync" },
];

export default function Reports() {
  const { activeLocationId } = useActiveLocation();
  const [activeTab, setActiveTab] = useState("promotions");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Promotions
  const [payouts, setPayouts] = useState([]);
  const [payoutFilter, setPayoutFilter] = useState("all");

  // Corporate
  const [accounts, setAccounts] = useState([]);

  // Inventory
  const [alerts, setAlerts] = useState([]);
  const [oversells, setOversells] = useState([]);

  // Sales
  const today = new Date().toISOString().slice(0, 10);
  const [salesStart, setSalesStart] = useState(today);
  const [salesEnd, setSalesEnd] = useState(today);
  const [salesReport, setSalesReport] = useState(null);

  // Loyalty
  const [loyaltyReport, setLoyaltyReport] = useState(null);

  // Customers
  const [customersReport, setCustomersReport] = useState(null);

  // Sync
  const [syncReport, setSyncReport] = useState(null);

  // Ledger
  const [ledgerStart, setLedgerStart] = useState(today);
  const [ledgerEnd, setLedgerEnd] = useState(today);
  const [ledgerReport, setLedgerReport] = useState(null);

  // Top customers
  const [topCustomersStart, setTopCustomersStart] = useState(today);
  const [topCustomersEnd, setTopCustomersEnd] = useState(today);
  const [topCustomers, setTopCustomers] = useState([]);

  // AR aging
  const [arAging, setArAging] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const load = async () => {
      try {
        if (activeTab === "promotions") {
          const data = await getPromoPayouts(true);
          if (!cancelled) setPayouts(data);
        } else if (activeTab === "corporate") {
          const data = await listCorporateAccounts();
          if (!cancelled) setAccounts(data);
        } else if (activeTab === "inventory") {
          const [alertsData, oversellsData] = await Promise.all([
            getLowStockAlerts(activeLocationId),
            getOversellFlags(false, activeLocationId),
          ]);
          if (!cancelled) {
            setAlerts(alertsData);
            setOversells(oversellsData);
          }
        } else if (activeTab === "sales") {
          const data = await getSalesReport(salesStart, salesEnd, activeLocationId);
          if (!cancelled) setSalesReport(data);
        } else if (activeTab === "loyalty") {
          const data = await getLoyaltyReport();
          if (!cancelled) setLoyaltyReport(data);
        } else if (activeTab === "customers") {
          const data = await getCustomersReport();
          if (!cancelled) setCustomersReport(data);
        } else if (activeTab === "sync") {
          const data = await getSyncReport(activeLocationId);
          if (!cancelled) setSyncReport(data);
        } else if (activeTab === "ledger") {
          const data = await getLedgerReport(ledgerStart, ledgerEnd, activeLocationId);
          if (!cancelled) setLedgerReport(data);
        } else if (activeTab === "top-customers") {
          const data = await getTopCustomersReport(topCustomersStart, topCustomersEnd, activeLocationId);
          if (!cancelled) setTopCustomers(data.customers || []);
        } else if (activeTab === "ar-aging") {
          const data = await getArAgingReport();
          if (!cancelled) setArAging(data);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load report data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, salesStart, salesEnd, ledgerStart, ledgerEnd, topCustomersStart, topCustomersEnd, activeLocationId]);

  const filteredPayouts = useMemo(() => {
    if (payoutFilter === "all") return payouts;
    return payouts.filter((p) => p.payout_status === payoutFilter);
  }, [payouts, payoutFilter]);

  const totalPayoutValue = useMemo(
    () =>
      filteredPayouts.reduce(
        (sum, p) => sum + parseFloat(p.cost_value || p.cashback_amount || 0),
        0,
      ),
    [filteredPayouts],
  );

  const renderExportButtons = (rows, filename) => (
    <div className="flex gap-2">
      <button
        onClick={() => downloadCsv(rows, `${filename}.csv`)}
        className="px-3 py-1.5 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors">
        CSV
      </button>
      <button
        onClick={() => downloadExcel(rows, `${filename}.xlsx`)}
        className="px-3 py-1.5 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors">
        Excel
      </button>
    </div>
  );

  const renderPromotions = () => {
    const rows = filteredPayouts.map((p) => ({
      date: new Date(p.created_at).toLocaleString("en-KE"),
      customer: p.customer_name || p.customer_phone || "—",
      type: p.type,
      detail:
        p.type === "cashback"
          ? `Cashback KES ${Number(p.cashback_amount || 0).toFixed(2)}`
          : p.reward_name || "Reward",
      value: Number(p.cost_value || 0).toFixed(2),
      status: p.payout_status,
    }));

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-textPrimary">Promo wins & payouts</h2>
          <div className="flex items-center gap-2">
            <select
              value={payoutFilter}
              onChange={(e) => setPayoutFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid / Issued</option>
              <option value="unfulfilled">Unfulfilled</option>
            </select>
            {renderExportButtons(rows, "promo-wins")}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="Total wins" value={payouts.length} />
          <StatBox label="Pending" value={payouts.filter((p) => p.payout_status === "pending").length} />
          <StatBox label="Paid / issued" value={payouts.filter((p) => p.payout_status === "paid").length} />
          <StatBox label="Unfulfilled" value={payouts.filter((p) => p.payout_status === "unfulfilled").length} />
        </div>
        <p className="text-textSecondary text-sm">
          Total value shown:{" "}
          <span className="font-semibold text-textPrimary">
            KES {totalPayoutValue.toFixed(2)}
          </span>
        </p>
        <DataTable
          columns={[
            { key: "date", label: "Date" },
            { key: "customer", label: "Customer" },
            { key: "type", label: "Type" },
            { key: "detail", label: "Detail" },
            { key: "value", label: "Value", right: true },
            { key: "status", label: "Status", center: true, badge: true },
          ]}
          rows={rows}
        />
      </div>
    );
  };

  const renderCorporate = () => {
    const rows = accounts.map((a) => {
      const available = (a.credit_limit || 0) - (a.current_balance || 0);
      return {
        customer: a.customer_name || a.customer_phone || `Account ${a.id}`,
        credit_limit: Number(a.credit_limit || 0).toFixed(2),
        current_balance: Number(a.current_balance || 0).toFixed(2),
        available_credit: available.toFixed(2),
      };
    });

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-textPrimary">Corporate accounts</h2>
          {renderExportButtons(rows, "corporate-accounts")}
        </div>
        <DataTable
          columns={[
            { key: "customer", label: "Customer" },
            { key: "credit_limit", label: "Credit limit", right: true },
            { key: "current_balance", label: "Current balance", right: true },
            { key: "available_credit", label: "Available credit", right: true, money: true },
          ]}
          rows={rows}
        />
      </div>
    );
  };

  const renderArAging = () => {
    const data = arAging || {};
    const invoices = data.invoices || [];
    const customers = data.customers || [];
    const invoiceRows = invoices.map((i) => ({
      id: i.id,
      customer: i.customer_name || i.customer_phone || `Account ${i.corporate_account_id}`,
      status: i.status,
      days: i.days,
      bucket: i.bucket,
      total: Number(i.total || 0).toFixed(2),
      paid: Number(i.paid || 0).toFixed(2),
      outstanding: Number(i.outstanding || 0).toFixed(2),
      due: i.due_date ? new Date(i.due_date).toLocaleDateString("en-KE") : new Date(i.created_at).toLocaleDateString("en-KE"),
    }));
    const customerRows = customers.map((c) => ({
      customer: c.customer_name || c.customer_phone || `Account ${c.corporate_account_id}`,
      invoices: c.invoices,
      outstanding: Number(c.outstanding || 0).toFixed(2),
    }));

    const bucketLabels = {
      current: "Current",
      "1to30": "1–30 days",
      "31to60": "31–60 days",
      over60: "Over 60 days",
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-textPrimary">Accounts receivable aging</h2>
          {renderExportButtons(invoiceRows, "ar-aging")}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="Outstanding" value={`KES ${Number(data.totalOutstanding || 0).toFixed(2)}`} />
          <StatBox label="Invoices" value={data.invoiceCount || 0} />
          <StatBox label="Customers" value={customers.length} />
          <StatBox label="Over 60" value={`KES ${Number(data.buckets?.over60 || 0).toFixed(2)}`} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(bucketLabels).map(([key, label]) => (
            <StatBox key={key} label={label} value={`KES ${Number(data.buckets?.[key] || 0).toFixed(2)}`} />
          ))}
        </div>

        <h3 className="text-md font-bold text-textPrimary">Outstanding by customer</h3>
        <DataTable
          columns={[
            { key: "customer", label: "Customer" },
            { key: "invoices", label: "Invoices", right: true },
            { key: "outstanding", label: "Outstanding", right: true },
          ]}
          rows={customerRows}
        />

        <h3 className="text-md font-bold text-textPrimary">Invoice detail</h3>
        <DataTable
          columns={[
            { key: "id", label: "Invoice" },
            { key: "customer", label: "Customer" },
            { key: "status", label: "Status" },
            { key: "days", label: "Days", right: true },
            { key: "bucket", label: "Bucket" },
            { key: "total", label: "Total", right: true },
            { key: "paid", label: "Paid", right: true },
            { key: "outstanding", label: "Outstanding", right: true },
            { key: "due", label: "Due / created" },
          ]}
          rows={invoiceRows}
        />
      </div>
    );
  };

  const renderInventory = () => {
    const alertRows = alerts.map((a) => ({
      item: `${a.brand || ""} ${a.weight_kg ? `${a.weight_kg}kg` : ""}`.trim() || "—",
      filled: a.filled_qty,
      empty: a.empty_qty,
      threshold: a.low_stock_threshold,
    }));
    const oversellRows = oversells.map((o) => ({
      item: o.item_name || "—",
      requested: o.requested,
      available: o.available,
    }));

    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-textPrimary">Low stock alerts</h2>
            {renderExportButtons(alertRows, "low-stock-alerts")}
          </div>
          <DataTable
            columns={[
              { key: "item", label: "Brand" },
              { key: "filled", label: "Filled qty", right: true },
              { key: "empty", label: "Empty qty", right: true },
              { key: "threshold", label: "Threshold", right: true },
            ]}
            rows={alertRows}
          />
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-textPrimary">Oversell flags</h2>
            {renderExportButtons(oversellRows, "oversell-flags")}
          </div>
          <DataTable
            columns={[
              { key: "item", label: "Item" },
              { key: "requested", label: "Requested", right: true },
              { key: "available", label: "Available", right: true },
            ]}
            rows={oversellRows}
          />
        </div>
      </div>
    );
  };

  const renderSales = () => {
    const summary = salesReport?.summary;
    const sales = salesReport?.sales || [];
    const rows = sales.map((s) => ({
      id: s.id,
      date: new Date(s.created_at).toLocaleString("en-KE"),
      customer: s.customer_name || s.customer_phone || "Walk-in",
      staff: s.staff_name || "—",
      method: s.payment_method,
      subtotal: Number(s.subtotal || 0).toFixed(2),
      discount: Number(s.discount_amount || 0).toFixed(2),
      total: Number(s.total || 0).toFixed(2),
      items: (s.items || []).map((i) => i.product_name || i.cylinder_brand || "Item").join(", "),
    }));

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-textPrimary">Sales report</h2>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={salesStart}
              onChange={(e) => setSalesStart(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm"
            />
            <span className="text-textSecondary text-sm">to</span>
            <input
              type="date"
              value={salesEnd}
              onChange={(e) => setSalesEnd(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm"
            />
            {renderExportButtons(rows, "sales-report")}
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox label="Transactions" value={summary.totalSales} />
            <StatBox label="Revenue" value={`KES ${Number(summary.totalRevenue || 0).toFixed(2)}`} />
            <StatBox label="Discounts" value={`KES ${Number(summary.totalDiscount || 0).toFixed(2)}`} />
            <StatBox label="Methods" value={Object.keys(summary.byMethod || {}).length} />
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MiniTable title="By payment method" rows={Object.entries(summary.byMethod || {}).map(([k, v]) => ({ label: k, value: `KES ${Number(v).toFixed(2)}` }))} />
            <MiniTable title="By day" rows={Object.entries(summary.byDay || {}).map(([k, v]) => ({ label: k, value: `${v.count} sales · KES ${Number(v.total).toFixed(2)}` }))} />
          </div>
        )}

        <DataTable
          columns={[
            { key: "id", label: "Sale ID" },
            { key: "date", label: "Date" },
            { key: "customer", label: "Customer" },
            { key: "staff", label: "Staff" },
            { key: "method", label: "Method" },
            { key: "subtotal", label: "Subtotal", right: true },
            { key: "discount", label: "Discount", right: true },
            { key: "total", label: "Total", right: true },
            { key: "items", label: "Items" },
          ]}
          rows={rows}
        />
      </div>
    );
  };

  const renderTopCustomers = () => {
    const rows = topCustomers.map((c, i) => ({
      rank: i + 1,
      name: c.name || "—",
      phone: c.phone,
      type: c.customer_type,
      sales: c.sale_count,
      spend: Number(c.total_spend || 0).toFixed(2),
      points: c.points_balance,
      last_purchase: c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString("en-KE") : "—",
    }));

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-textPrimary">Top customers</h2>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={topCustomersStart}
              onChange={(e) => setTopCustomersStart(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm"
            />
            <span className="text-textSecondary text-sm">to</span>
            <input
              type="date"
              value={topCustomersEnd}
              onChange={(e) => setTopCustomersEnd(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm"
            />
            {renderExportButtons(rows, "top-customers")}
          </div>
        </div>

        <DataTable
          columns={[
            { key: "rank", label: "#" },
            { key: "name", label: "Customer" },
            { key: "phone", label: "Phone" },
            { key: "type", label: "Type" },
            { key: "sales", label: "Sales", right: true },
            { key: "spend", label: "Total spend", right: true },
            { key: "points", label: "Points", right: true },
            { key: "last_purchase", label: "Last purchase" },
          ]}
          rows={rows}
        />
      </div>
    );
  };

  const renderLedger = () => {
    const income = ledgerReport?.income;
    const expenses = ledgerReport?.expenses;
    const net = ledgerReport?.netIncome;
    const rows = Object.entries(income?.byMethod || {}).map(([method, data]) => ({
      category: "Income",
      item: method.toUpperCase(),
      count: data.count,
      amount: Number(data.total || 0).toFixed(2),
    }));
    rows.push(
      { category: "Expense", item: "Cashback payouts", count: Number(expenses?.promoCashbackCount || 0), amount: Number(expenses?.promoCashback || 0).toFixed(2) },
      { category: "Expense", item: "Prize payouts", count: Number(expenses?.promoPrizesCount || 0), amount: Number(expenses?.promoPrizes || 0).toFixed(2) },
      { category: "Expense", item: "Reward redemptions", count: Number(expenses?.rewardsCount || 0), amount: Number(expenses?.rewards || 0).toFixed(2) },
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-textPrimary">Income & expenses ledger</h2>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={ledgerStart}
              onChange={(e) => setLedgerStart(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm"
            />
            <span className="text-textSecondary text-sm">to</span>
            <input
              type="date"
              value={ledgerEnd}
              onChange={(e) => setLedgerEnd(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm"
            />
            {renderExportButtons(rows, "ledger")}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="Total income" value={`KES ${Number(income?.total || 0).toFixed(2)}`} />
          <StatBox label="Total expenses" value={`KES ${Number(expenses?.total || 0).toFixed(2)}`} />
          <StatBox label="Net income" value={`KES ${Number(net || 0).toFixed(2)}`} />
          <StatBox
            label="Payouts pending"
            value={`KES ${Number(expenses?.byStatus?.pending || 0).toFixed(2)}`}
            sub={`${Number(expenses?.byStatus?.pendingCount || 0)} pending`}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox
            label="Cashback payouts"
            value={Number(expenses?.promoCashbackCount || 0)}
            sub={`KES ${Number(expenses?.promoCashback || 0).toFixed(2)}`}
          />
          <StatBox
            label="Prize payouts"
            value={Number(expenses?.promoPrizesCount || 0)}
            sub={`KES ${Number(expenses?.promoPrizes || 0).toFixed(2)}`}
          />
          <StatBox
            label="Reward redemptions"
            value={Number(expenses?.rewardsCount || 0)}
            sub={`KES ${Number(expenses?.rewards || 0).toFixed(2)}`}
          />
          <StatBox
            label="Payouts issued"
            value={Number(expenses?.byStatus?.paidCount || 0)}
            sub={`KES ${Number(expenses?.byStatus?.paid || 0).toFixed(2)}`}
          />
        </div>

        <DataTable
          columns={[
            { key: "category", label: "Category" },
            { key: "item", label: "Item" },
            { key: "count", label: "Count", right: true },
            { key: "amount", label: "Amount", right: true },
          ]}
          rows={rows}
        />
      </div>
    );
  };

  const renderLoyalty = () => {
    const entries = loyaltyReport?.entries || [];
    const balances = loyaltyReport?.balances || [];
    const rows = entries.map((e) => ({
      date: new Date(e.created_at).toLocaleString("en-KE"),
      customer: e.customer_name || e.customer_phone || `Customer ${e.customer_id}`,
      type: e.type,
      points: e.points,
      balance_after: e.balance_after,
    }));

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-textPrimary">Loyalty report</h2>
          {renderExportButtons(rows, "loyalty-ledger")}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="Total liability" value={loyaltyReport?.totalLiability || 0} />
          <StatBox label="Ledger entries" value={entries.length} />
          <StatBox label="Active balances" value={balances.length} />
        </div>
        <DataTable
          columns={[
            { key: "date", label: "Date" },
            { key: "customer", label: "Customer" },
            { key: "type", label: "Type" },
            { key: "points", label: "Points", right: true },
            { key: "balance_after", label: "Balance after", right: true },
          ]}
          rows={rows}
        />
      </div>
    );
  };

  const renderCustomers = () => {
    const customers = customersReport?.customers || [];
    const rows = customers.map((c) => ({
      id: c.id,
      name: c.name || "—",
      phone: c.phone,
      alt_phone: c.alt_phone || "—",
      email: c.email || "—",
      consent: c.consent_given_at ? `Yes (${new Date(c.consent_given_at).toLocaleDateString("en-KE")})` : "No",
      sms_opt_in: c.sms_opt_in ? "Yes" : "No",
      created: new Date(c.created_at).toLocaleDateString("en-KE"),
      status: c.voided_at ? "Voided" : "Active",
    }));

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-textPrimary">Customer report</h2>
          {renderExportButtons(rows, "customers")}
        </div>
        <p className="text-textSecondary text-sm">
          Duplicate phone flags: {customersReport?.duplicatePhoneFlags?.length || 0}
        </p>
        <DataTable
          columns={[
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
            { key: "phone", label: "Phone" },
            { key: "alt_phone", label: "Alt phone" },
            { key: "consent", label: "Consent" },
            { key: "sms_opt_in", label: "SMS opt-in" },
            { key: "created", label: "Created" },
            { key: "status", label: "Status" },
          ]}
          rows={rows}
        />
      </div>
    );
  };

  const renderSync = () => {
    const errors = syncReport?.recentErrors || [];
    const rows = errors.map((e, i) => ({
      id: e.id ?? i,
      date: new Date(e.synced_at || e.created_at).toLocaleString("en-KE"),
      sale_id: e.id,
      local_id: e.local_id,
      total: Number(e.total || 0).toFixed(2),
      method: e.payment_method,
    }));

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-textPrimary">Sync report</h2>
          {renderExportButtons(rows, "sync-conflicts")}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="Pending sales" value={syncReport?.pendingSales || 0} />
          <StatBox label="Conflicts" value={syncReport?.conflicts || 0} />
          <StatBox label="Recent conflicts" value={errors.length} />
          <StatBox label="Last sync" value={syncReport?.lastSync ? new Date(syncReport.lastSync).toLocaleTimeString("en-KE") : "—"} />
        </div>
        <DataTable
          columns={[
            { key: "date", label: "Date" },
            { key: "sale_id", label: "Sale ID" },
            { key: "local_id", label: "Local ID" },
            { key: "method", label: "Method" },
            { key: "total", label: "Total", right: true },
          ]}
          rows={rows}
        />
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case "promotions":
        return renderPromotions();
      case "corporate":
        return renderCorporate();
      case "ar-aging":
        return renderArAging();
      case "inventory":
        return renderInventory();
      case "sales":
        return renderSales();
      case "top-customers":
        return renderTopCustomers();
      case "ledger":
        return renderLedger();
      case "loyalty":
        return renderLoyalty();
      case "customers":
        return renderCustomers();
      case "sync":
        return renderSync();
      default:
        return null;
    }
  };

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-textPrimary">Reports</h1>
      <p className="text-textSecondary text-sm mt-1">
        Overview of sales, promotions, inventory, loyalty, and accounts.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-onPrimary"
                : "bg-surface1 border border-borderColor text-textSecondary hover:bg-surface2 hover:text-textPrimary"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 p-3 rounded-xl bg-danger/10 text-danger text-sm">{error}</p>
      )}

      <section className="mt-6 p-4 rounded-2xl bg-surface1 border border-borderColor">
        {loading ? (
          <p className="text-textMuted text-sm">Loading report data...</p>
        ) : (
          renderContent()
        )}
      </section>
    </main>
  );
}

function StatBox({ label, value, sub }) {
  return (
    <div className="p-3 rounded-xl bg-surface2 border border-borderColor text-center">
      <p className="text-lg font-bold text-textPrimary truncate">{value}</p>
      <p className="text-textSecondary text-xs">{label}</p>
      {sub && <p className="text-textMuted text-xs mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-borderColor">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface2 text-textSecondary">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`p-3 text-left font-semibold ${col.right ? "text-right" : col.center ? "text-center" : ""}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-4 text-center text-textMuted text-sm">
                  No data.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={row.id ?? idx} className="border-t border-borderColor text-textPrimary">
                {columns.map((col) => {
                  const raw = row[col.key];
                  const content = col.badge ? (
                    <StatusBadge status={raw} />
                  ) : (
                    raw
                  );
                  return (
                    <td
                      key={col.key}
                      className={`p-3 ${col.right ? "text-right" : col.center ? "text-center" : ""} ${col.money && Number(raw) < 0 ? "text-danger" : ""}`}>
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniTable({ title, rows }) {
  return (
    <div className="rounded-xl border border-borderColor bg-surface2 p-3">
      <h3 className="text-sm font-bold text-textPrimary mb-2">{title}</h3>
      {rows.length === 0 && <p className="text-textMuted text-xs">No data.</p>}
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={i} className="flex justify-between text-xs text-textSecondary">
            <span>{r.label}</span>
            <span className="font-medium text-textPrimary">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: "bg-warning/10 text-warning",
    paid: "bg-success/10 text-success",
    unfulfilled: "bg-danger/10 text-danger",
  };
  return (
    <span
      className={`inline-block px-2 py-1 rounded-lg text-xs font-semibold capitalize ${
        styles[status] || "bg-surface2 text-textSecondary"
      }`}>
      {status}
    </span>
  );
}

async function download(rows, filename, type) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  const wbout = XLSX.write(workbook, { bookType: type, type: "array" });
  const blob = new Blob([wbout], {
    type: type === "csv" ? "text/csv;charset=utf-8;" : "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadCsv(rows, filename) {
  download(rows, filename, "csv");
}

function downloadExcel(rows, filename) {
  download(rows, filename, "xlsx");
}
