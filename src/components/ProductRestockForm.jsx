import { useEffect, useMemo, useState } from "react";
import { createProductRestock } from "../lib/api";

const inputClass =
  "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";

export default function ProductRestockForm({
  locationId,
  products,
  initialLines = [{ product_id: "", quantity: "", unit_cost: "" }],
  onSuccess,
  onCancel,
  cancelLabel = "Clear",
  submitLabel = "Record restock",
}) {
  const [lines, setLines] = useState(initialLines);
  const [extras, setExtras] = useState([]);
  const [supplierName, setSupplierName] = useState("");
  const [reference, setReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!success && !error) return;
    const timer = setTimeout(() => {
      setSuccess("");
      setError("");
    }, 4000);
    return () => clearTimeout(timer);
  }, [success, error]);

  const productsById = useMemo(() => {
    const map = new Map();
    for (const product of products) map.set(String(product.id), product);
    return map;
  }, [products]);

  const lineCalculations = useMemo(() => {
    const items = lines.map((line) => {
      const product = productsById.get(String(line.product_id));
      const qty = Math.max(0, parseInt(line.quantity, 10) || 0);
      const unitCost = parseFloat(line.unit_cost) || 0;
      return {
        line,
        product,
        qty,
        productCost: qty * unitCost,
      };
    });
    const totalQty = items.reduce((sum, l) => sum + l.qty, 0);
    const extrasTotal = extras.reduce(
      (sum, e) => sum + Number((Math.max(0, parseFloat(e.amount) || 0)).toFixed(2)),
      0
    );
    let allocatedSoFar = 0;
    const calculated = items.map((l, index) => {
      let allocated = 0;
      if (totalQty > 0) {
        allocated = Number((extrasTotal * (l.qty / totalQty)).toFixed(2));
        if (index === items.length - 1) {
          allocated = Number((extrasTotal - allocatedSoFar).toFixed(2));
        }
      }
      allocatedSoFar = Number((allocatedSoFar + allocated).toFixed(2));
      const totalCapitalized = Number((l.productCost + allocated).toFixed(2));
      const landedUnitCost = l.qty > 0 ? Number((totalCapitalized / l.qty).toFixed(2)) : 0;
      return { ...l, allocated, totalCapitalized, landedUnitCost };
    });
    const productTotal = items.reduce((sum, l) => sum + l.productCost, 0);
    return {
      lines: calculated,
      totalQty,
      productTotal,
      extrasTotal,
      grandTotal: Number((productTotal + extrasTotal).toFixed(2)),
    };
  }, [lines, extras, productsById]);

  const addLine = () =>
    setLines((previous) => [
      ...previous,
      { product_id: "", quantity: "", unit_cost: "" },
    ]);

  const removeLine = (index) =>
    setLines((previous) => (previous.length > 1 ? previous.filter((_, i) => i !== index) : previous));

  const updateLine = (index, field, value) => {
    setLines((previous) => previous.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  };

  const addExtra = () => setExtras((previous) => [...previous, { description: "", amount: "" }]);

  const updateExtra = (index, field, value) => {
    setExtras((previous) => previous.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  };

  const removeExtra = (index) => setExtras((previous) => previous.filter((_, i) => i !== index));

  const resetForm = () => {
    setLines(initialLines);
    setExtras([]);
    setSupplierName("");
    setReference("");
    setPaymentMethod("cash");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setNotes("");
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      resetForm();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const seen = new Set();
    const payloadLines = [];
    for (const line of lines) {
      const productId = Number(line.product_id);
      if (!Number.isInteger(productId) || productId <= 0) {
        setError("Select a product for every line");
        return;
      }
      if (seen.has(productId)) {
        setError("Duplicate product selected");
        return;
      }
      seen.add(productId);
      const qty = Number(line.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        setError("Enter a valid whole-number quantity for every line");
        return;
      }
      const product = productsById.get(String(productId));
      if (!product) {
        setError("Selected product not found");
        return;
      }
      const cost = parseFloat(line.unit_cost);
      if (!Number.isFinite(cost) || cost < 0) {
        setError("Enter a valid unit cost for every line");
        return;
      }
      payloadLines.push({ product_id: productId, quantity: qty, unit_cost: cost });
    }

    for (const extra of extras) {
      if (extra.description.trim() || parseFloat(extra.amount) > 0) {
        if (!extra.description.trim()) {
          setError("Description is required for every extra");
          return;
        }
        if (!(parseFloat(extra.amount) > 0)) {
          setError("Amount must be positive for every extra");
          return;
        }
      }
    }

    if (!locationId) {
      setError("Select a specific shop to record a restock");
      return;
    }

    setSaving(true);
    try {
      await createProductRestock({
        location_id: locationId,
        lines: payloadLines,
        extra_lines: extras
          .filter((e) => e.description.trim() && parseFloat(e.amount) > 0)
          .map((e) => ({ description: e.description.trim(), quantity: 1, unit_cost: parseFloat(e.amount) })),
        supplier_name: supplierName.trim() || undefined,
        reference: reference.trim() || undefined,
        payment_method: paymentMethod,
        expense_date: expenseDate,
        notes: notes.trim() || undefined,
      });
      setSuccess("Restock recorded successfully.");
      resetForm();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || "Failed to record restock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset disabled={saving} className="space-y-5 min-w-0 border-0 p-0 m-0">
        {success && (
          <div className="p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
            {success}
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-medium">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-textMuted text-xs">Accessory lines</label>
          </div>
          {lines.map((line, index) => {
            const product = productsById.get(String(line.product_id));
            const calc = lineCalculations.lines[index];
            return (
              <div key={index} className="p-3 rounded-xl bg-surface1 border border-borderColor space-y-3">
                <div>
                  <label className="text-textMuted text-xs block mb-1">Product</label>
                  <select
                    value={line.product_id}
                    onChange={(e) => updateLine(index, "product_id", e.target.value)}
                    className={inputClass}>
                    <option value="">Choose product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.qty_on_hand ?? 0} in stock
                      </option>
                    ))}
                  </select>
                </div>
                {product && (
                  <p className="text-textSecondary text-xs">
                    Current stock:{" "}
                    <span className="font-medium text-textPrimary">
                      {product.qty_on_hand ?? 0} {product.pricing_type === "weighted" ? "kg" : "units"}
                    </span>
                    {Number(product.avg_cost) > 0 && (
                      <> · Avg cost <span className="font-medium text-textPrimary">KES {Number(product.avg_cost).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></>
                    )}
                  </p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-textMuted text-xs block mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, "quantity", e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-textMuted text-xs block mb-1">Unit cost</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unit_cost}
                      onChange={(e) => updateLine(index, "unit_cost", e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div className="col-span-2 flex flex-col justify-center">
                    <p className="text-textSecondary text-xs">Landed cost per unit</p>
                    <p className="text-textPrimary font-semibold text-sm">
                      KES{" "}
                      {calc?.landedUnitCost.toLocaleString("en-KE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }) || "0.00"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="px-2 py-1 rounded-lg border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/10">
                      Remove line
                    </button>
                  )}
                  {index === lines.length - 1 && (
                    <button
                      type="button"
                      onClick={addLine}
                      className="px-2 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3">
                      + Add product
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 rounded-xl bg-surface1 border border-borderColor space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-textMuted text-xs">Shared landed cost extras (transport, labor, etc.)</label>
            <button
              type="button"
              onClick={addExtra}
              className="px-2 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3">
              + Add extra
            </button>
          </div>
          {extras.map((extra, index) => (
            <div key={index} className="grid grid-cols-[1fr,auto,auto] gap-2 items-center">
              <input
                type="text"
                placeholder="Description e.g. Transport"
                value={extra.description}
                onChange={(e) => updateExtra(index, "description", e.target.value)}
                className={inputClass}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                value={extra.amount}
                onChange={(e) => updateExtra(index, "amount", e.target.value)}
                className={`${inputClass} w-28`}
              />
              <button
                type="button"
                onClick={() => removeExtra(index)}
                className="px-2 py-1 rounded-lg border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/10">
                ×
              </button>
            </div>
          ))}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-textSecondary pt-1 border-t border-borderColor/50">
            <div>
              <p>Product total</p>
              <p className="text-textPrimary font-medium">
                KES{" "}
                {lineCalculations.productTotal.toLocaleString("en-KE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p>Extras total</p>
              <p className="text-textPrimary font-medium">
                KES{" "}
                {lineCalculations.extrasTotal.toLocaleString("en-KE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p>Units received</p>
              <p className="text-textPrimary font-medium">{lineCalculations.totalQty}</p>
            </div>
            <div>
              <p>Receipt total</p>
              <p className="text-textPrimary font-medium">
                KES{" "}
                {lineCalculations.grandTotal.toLocaleString("en-KE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="text-textMuted text-xs block mb-1">Supplier</label>
          <input
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className={inputClass}
            placeholder="Supplier name"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-textMuted text-xs block mb-1">Reference</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={inputClass}
              placeholder="Invoice / receipt"
            />
          </div>
          <div>
            <label className="text-textMuted text-xs block mb-1">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={inputClass}>
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cheque">Cheque</option>
              <option value="credit">Credit</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-textMuted text-xs block mb-1">Expense date</label>
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className="text-textMuted text-xs block mb-1">Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
            placeholder="Optional notes"
          />
        </div>
      </fieldset>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold disabled:opacity-50">
          {saving ? "Saving..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="px-4 py-2 rounded-lg border border-borderColor bg-surface1 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary disabled:opacity-50">
          {cancelLabel}
        </button>
      </div>
    </form>
  );
}
