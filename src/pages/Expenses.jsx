import { useEffect, useMemo, useState } from "react";
import { useActiveLocation } from "../contexts/LocationContext";
import { getExpenses, createExpense, voidExpense } from "../lib/api";

const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
};

const BUSINESS_OPTIONS = ["all", "butchery", "gas", "shared"];
const CATEGORY_OPTIONS = [
  "all",
  "inventory",
  "supplies",
  "utilities",
  "rent",
  "salaries",
  "gas_refill",
  "maintenance",
  "transport",
  "other",
];
const PAYMENT_OPTIONS = ["cash", "mpesa", "bank_transfer", "cheque", "credit", "other"];

const inputClass =
  "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";

function StatBox({ label, value, sub }) {
  return (
    <div className="p-3 rounded-xl bg-surface2 border border-borderColor text-center">
      <p className="text-lg font-bold text-textPrimary truncate">{value}</p>
      <p className="text-textSecondary text-xs">{label}</p>
      {sub && <p className="text-textMuted text-xs mt-0.5 truncate">{sub}</p>}
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
    active: "bg-success/10 text-success",
    posted: "bg-success/10 text-success",
    voided: "bg-danger/10 text-danger",
    pending: "bg-warning/10 text-warning",
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

function ExpenseForm({ onSaved, onCancel }) {
  const { activeLocationId } = useActiveLocation();
  const [businessType, setBusinessType] = useState("shared");
  const [category, setCategory] = useState("inventory");
  const [supplierName, setSupplierName] = useState("");
  const [reference, setReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [expenseDate, setExpenseDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([
    { description: "", product_id: "", quantity: "", unit: "", unit_cost: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalAmount = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = parseFloat(line.quantity) || 0;
        const cost = parseFloat(line.unit_cost) || 0;
        return sum + qty * cost;
      }, 0),
    [lines],
  );

  const updateLine = (index, field, value) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
    );
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { description: "", product_id: "", quantity: "", unit: "", unit_cost: "" },
    ]);
  };

  const removeLine = (index) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!activeLocationId) {
      setError("Active location is required");
      return;
    }
    if (lines.some((line) => !line.description.trim())) {
      setError("Every line needs a description");
      return;
    }
    if (lines.some((line) => (parseFloat(line.quantity) || 0) <= 0)) {
      setError("Quantity must be greater than zero on every line");
      return;
    }
    if (lines.some((line) => (parseFloat(line.unit_cost) || 0) < 0)) {
      setError("Unit cost cannot be negative");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        location_id: activeLocationId,
        business_type: businessType,
        category,
        supplier_name: supplierName.trim() || undefined,
        reference: reference.trim() || undefined,
        payment_method: paymentMethod,
        expense_date: expenseDate,
        notes: notes.trim() || undefined,
        lines: lines.map((line) => ({
          description: line.description.trim(),
          ...(line.product_id ? { product_id: Number(line.product_id) } : {}),
          quantity: parseFloat(line.quantity),
          unit: line.unit.trim() || "pcs",
          unit_cost: parseFloat(line.unit_cost) || 0,
        })),
      };
      await createExpense(payload);
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-textMuted text-xs block mb-1">Business type</label>
          <select
            className={inputClass}
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}>
            {BUSINESS_OPTIONS.filter((o) => o !== "all").map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-textMuted text-xs block mb-1">Category</label>
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTIONS.filter((o) => o !== "all").map((option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-textMuted text-xs block mb-1">Payment method</label>
          <select
            className={inputClass}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-textMuted text-xs block mb-1">Supplier</label>
          <input
            className={inputClass}
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Supplier name"
          />
        </div>
        <div>
          <label className="text-textMuted text-xs block mb-1">Reference</label>
          <input
            className={inputClass}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Invoice / receipt number"
          />
        </div>
        <div>
          <label className="text-textMuted text-xs block mb-1">Expense date</label>
          <input
            type="date"
            className={inputClass}
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-textMuted text-xs block mb-1">Notes</label>
        <textarea
          className={inputClass}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </div>

      <div className="rounded-2xl bg-surface1 border border-borderColor p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-textPrimary text-sm font-semibold">Expense lines</p>
          <button
            type="button"
            onClick={addLine}
            className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary">
            + Add line
          </button>
        </div>

        {lines.map((line, index) => (
          <div
            key={index}
            className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border-b border-borderColor last:border-0 pb-3 last:pb-0">
            <div className="md:col-span-4">
              <label className="text-textMuted text-xs block mb-1">Description</label>
              <input
                className={inputClass}
                value={line.description}
                onChange={(e) => updateLine(index, "description", e.target.value)}
                placeholder="Item description"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-textMuted text-xs block mb-1">Product ID</label>
              <input
                type="number"
                className={inputClass}
                value={line.product_id}
                onChange={(e) => updateLine(index, "product_id", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-textMuted text-xs block mb-1">Qty</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={line.quantity}
                onChange={(e) => updateLine(index, "quantity", e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-textMuted text-xs block mb-1">Unit</label>
              <input
                className={inputClass}
                value={line.unit}
                onChange={(e) => updateLine(index, "unit", e.target.value)}
                placeholder="pcs"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-textMuted text-xs block mb-1">Unit cost</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={line.unit_cost}
                onChange={(e) => updateLine(index, "unit_cost", e.target.value)}
              />
            </div>
            <div className="md:col-span-1 flex justify-end">
              <button
                type="button"
                onClick={() => removeLine(index)}
                className="px-3 py-2 rounded-lg border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/10">
                Remove
              </button>
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-2">
          <p className="text-textPrimary text-sm font-semibold">
            Total: KES {totalAmount.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold disabled:opacity-50">
          {saving ? "Saving..." : "Save expense"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ExpenseDetail({ expense, onVoid, onClose, voidingId }) {
  const isVoided = expense.status === "voided";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface2 border border-borderColor p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-textPrimary">Expense #{expense.id}</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg border border-borderColor bg-surface1 text-textSecondary text-xs font-semibold hover:bg-surface3">
            Close
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatBox label="Date" value={expense.expense_date ? new Date(expense.expense_date).toLocaleDateString("en-KE") : "—"} />
          <StatBox label="Total" value={`KES ${Number(expense.total_amount || 0).toFixed(2)}`} />
          <StatBox label="Status" value={<StatusBadge status={expense.status || "active"} />} />
          <StatBox label="Payment" value={expense.payment_method || "—"} />
        </div>

        <div className="space-y-1 text-sm text-textSecondary mb-4">
          <p>
            <span className="text-textMuted">Business:</span>{" "}
            {expense.business_type || "—"}
          </p>
          <p>
            <span className="text-textMuted">Category:</span>{" "}
            {expense.category ? expense.category.replace(/_/g, " ") : "—"}
          </p>
          <p>
            <span className="text-textMuted">Supplier:</span>{" "}
            {expense.supplier_name || "—"}
          </p>
          <p>
            <span className="text-textMuted">Reference:</span>{" "}
            {expense.reference || "—"}
          </p>
          {expense.staff_name && (
            <p>
              <span className="text-textMuted">Recorded by:</span> {expense.staff_name}
            </p>
          )}
          {expense.notes && (
            <p>
              <span className="text-textMuted">Notes:</span> {expense.notes}
            </p>
          )}
        </div>

        <h3 className="text-sm font-bold text-textPrimary mb-2">Lines</h3>
        <div className="rounded-xl overflow-hidden border border-borderColor mb-4">
          <table className="w-full text-sm">
            <thead className="bg-surface1 text-textSecondary">
              <tr>
                <th className="p-3 text-left font-semibold">Description</th>
                <th className="p-3 text-right font-semibold">Qty</th>
                <th className="p-3 text-right font-semibold">Unit cost</th>
                <th className="p-3 text-right font-semibold">Line total</th>
              </tr>
            </thead>
            <tbody>
              {(expense.lines || []).map((line, idx) => (
                <tr key={idx} className="border-t border-borderColor text-textPrimary">
                  <td className="p-3">{line.description}</td>
                  <td className="p-3 text-right">
                    {Number(line.quantity || 0)} {line.unit}
                  </td>
                  <td className="p-3 text-right">
                    KES {Number(line.unit_cost || 0).toFixed(2)}
                  </td>
                  <td className="p-3 text-right">
                    KES {(Number(line.quantity || 0) * Number(line.unit_cost || 0)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isVoided && (
          <button
            type="button"
            onClick={() => onVoid(expense)}
            disabled={voidingId === expense.id}
            className="px-4 py-2 rounded-lg bg-danger text-onPrimary text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {voidingId === expense.id ? "Voiding..." : "Void expense"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Expenses() {
  const { activeLocationId } = useActiveLocation();
  const [activeTab, setActiveTab] = useState("history");
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [businessType, setBusinessType] = useState("all");
  const [category, setCategory] = useState("all");
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [voidingId, setVoidingId] = useState(null);

  const loadExpenses = async () => {
    if (!activeLocationId) return;
    setLoading(true);
    setError("");
    try {
      const data = await getExpenses({
        startDate,
        endDate,
        businessType: businessType === "all" ? "" : businessType,
        category: category === "all" ? "" : category,
        locationId: activeLocationId,
      });
      setExpenses(data.expenses || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeLocationId) loadExpenses();
  }, [activeLocationId, startDate, endDate, businessType, category]);

  const handleSaved = () => {
    setActiveTab("history");
    loadExpenses();
  };

  const handleVoid = async (expense) => {
    if (!window.confirm(`Void expense #${expense.id}? This cannot be undone.`)) return;
    setVoidingId(expense.id);
    try {
      await voidExpense(expense.id, activeLocationId);
      setSelectedExpense(null);
      loadExpenses();
    } catch (err) {
      setError(err.message || "Failed to void expense");
    } finally {
      setVoidingId(null);
    }
  };

  const categoryRows = useMemo(
    () =>
      Object.entries(summary?.byCategory || {}).map(([label, value]) => ({
        label: label.replace(/_/g, " "),
        value: `KES ${Number(value).toFixed(2)}`,
      })),
    [summary],
  );

  const businessRows = useMemo(
    () =>
      Object.entries(summary?.byBusiness || {}).map(([label, value]) => ({
        label,
        value: `KES ${Number(value).toFixed(2)}`,
      })),
    [summary],
  );

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-textPrimary">Expenses</h1>
      <p className="text-textSecondary text-sm mt-1">Record and review business expenses.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === "history"
              ? "bg-primary text-onPrimary"
              : "bg-surface1 border border-borderColor text-textSecondary hover:bg-surface2 hover:text-textPrimary"
          }`}>
          History
        </button>
        <button
          onClick={() => setActiveTab("new")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === "new"
              ? "bg-primary text-onPrimary"
              : "bg-surface1 border border-borderColor text-textSecondary hover:bg-surface2 hover:text-textPrimary"
          }`}>
          New expense
        </button>
      </div>

      {error && (
        <p className="mt-4 p-3 rounded-xl bg-danger/10 text-danger text-sm">{error}</p>
      )}

      <section className="mt-6 p-4 rounded-2xl bg-surface1 border border-borderColor">
        {activeTab === "new" ? (
          <ExpenseForm onSaved={handleSaved} onCancel={() => setActiveTab("history")} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-textMuted text-xs block mb-1">Start date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-textMuted text-xs block mb-1">End date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-textMuted text-xs block mb-1">Business type</label>
                <select
                  className={inputClass}
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}>
                  {BUSINESS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "all" ? "All" : option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-textMuted text-xs block mb-1">Category</label>
                <select
                  className={inputClass}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "all" ? "All" : option.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={loadExpenses}
                disabled={loading}
                className="px-4 py-2 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary disabled:opacity-50">
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {summary && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatBox label="Total" value={`KES ${Number(summary.total || 0).toFixed(2)}`} />
                  <StatBox label="Count" value={summary.count || 0} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MiniTable title="By category" rows={categoryRows} />
                  <MiniTable title="By business" rows={businessRows} />
                </div>
              </>
            )}

            <div className="rounded-2xl overflow-hidden border border-borderColor">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface2 text-textSecondary">
                    <tr>
                      <th className="p-3 text-left font-semibold">Date</th>
                      <th className="p-3 text-left font-semibold">Supplier</th>
                      <th className="p-3 text-left font-semibold">Category</th>
                      <th className="p-3 text-left font-semibold">Business</th>
                      <th className="p-3 text-right font-semibold">Total</th>
                      <th className="p-3 text-center font-semibold">Status</th>
                      <th className="p-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-textMuted text-sm">
                          No expenses found.
                        </td>
                      </tr>
                    )}
                    {loading && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-textMuted text-sm">
                          Loading expenses...
                        </td>
                      </tr>
                    )}
                    {expenses.map((expense) => (
                      <tr
                        key={expense.id}
                        className="border-t border-borderColor text-textPrimary hover:bg-surface2/50">
                        <td className="p-3">
                          {expense.expense_date
                            ? new Date(expense.expense_date).toLocaleDateString("en-KE")
                            : "—"}
                        </td>
                        <td className="p-3">{expense.supplier_name || "—"}</td>
                        <td className="p-3">
                          {expense.category ? expense.category.replace(/_/g, " ") : "—"}
                        </td>
                        <td className="p-3">{expense.business_type || "—"}</td>
                        <td className="p-3 text-right">
                          KES {Number(expense.total_amount || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <StatusBadge status={expense.status || "active"} />
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedExpense(expense)}
                            className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      {selectedExpense && (
        <ExpenseDetail
          expense={selectedExpense}
          onClose={() => setSelectedExpense(null)}
          onVoid={handleVoid}
          voidingId={voidingId}
        />
      )}
    </main>
  );
}
