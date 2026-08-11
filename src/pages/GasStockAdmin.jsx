import { useState, useEffect, useCallback } from "react";
import {
  getCylinderStockAdmin,
  adjustCylinderStock,
  updateStockThreshold,
  getOversellFlags,
  resolveOversellFlag,
} from "../lib/api";
import CylinderBrandForm from "../components/CylinderBrandForm";

const inputClass =
  "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";




function StockRow({
  item,
  isAdmin,
  onToast,
  onUpdated,
  onEdit,
  isExpanded,
  onCancelEdit,
}) {
  const [editing, setEditing] = useState(false);
  const [filledQty, setFilledQty] = useState(item.filled_qty);
  const [emptyQty, setEmptyQty] = useState(item.empty_qty);
  const [threshold, setThreshold] = useState(item.low_stock_threshold);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const qtyChanged =
        parseInt(filledQty) !== item.filled_qty ||
        parseInt(emptyQty) !== item.empty_qty;
      const thresholdChanged = parseInt(threshold) !== item.low_stock_threshold;

      if (qtyChanged) {
        await adjustCylinderStock(item.cylinder_brand_id, {
          filled_qty: parseInt(filledQty),
          empty_qty: parseInt(emptyQty),
        });
      }
      if (thresholdChanged) {
        await updateStockThreshold(item.cylinder_brand_id, parseInt(threshold));
      }

      onUpdated();
      setEditing(false);
      onToast("Stock updated.");
    } catch (err) {
      onToast(err.message || "Failed to update stock");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFilledQty(item.filled_qty);
    setEmptyQty(item.empty_qty);
    setThreshold(item.low_stock_threshold);
    setEditing(false);
  };

  const stockVariant =
    item.filled_qty <= 0 ? "danger" : item.is_low_stock ? "warning" : "success";

  return (
    <>
      <tr className="border-b border-borderColor last:border-0">
        <td className="py-3 px-4">
          <p className="text-textPrimary font-semibold text-sm">
            {item.brand} {item.weight_kg}kg
          </p>
          {!item.is_active && (
            <span className="text-xs text-danger">Inactive</span>
          )}
        </td>
        <td className="py-3 px-4 text-center">
          {editing ? (
            <input
              type="number"
              min="0"
              value={filledQty}
              onChange={(e) => setFilledQty(e.target.value)}
              className="w-20 px-2 py-1 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm text-center focus:outline-none focus:border-primary"
            />
          ) : (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                stockVariant === "danger"
                  ? "bg-danger/10 text-danger"
                  : stockVariant === "warning"
                    ? "bg-warning/10 text-warning"
                    : "bg-success/10 text-success"
              }`}>
              {item.filled_qty}
            </span>
          )}
        </td>
        <td className="py-3 px-4 text-center">
          {editing ? (
            <input
              type="number"
              min="0"
              value={emptyQty}
              onChange={(e) => setEmptyQty(e.target.value)}
              className="w-20 px-2 py-1 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm text-center focus:outline-none focus:border-primary"
            />
          ) : (
            <span className="text-textSecondary text-sm">{item.empty_qty}</span>
          )}
        </td>
        <td className="py-3 px-4 text-center">
          {editing ? (
            <input
              type="number"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-20 px-2 py-1 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm text-center focus:outline-none focus:border-primary"
            />
          ) : (
            <span className="text-textMuted text-sm">
              {item.low_stock_threshold}
            </span>
          )}
        </td>
        <td className="py-3 px-4 text-center">
          {item.is_low_stock && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/10 text-warning">
              Low
            </span>
          )}
        </td>
        {isAdmin && (
          <td className="py-3 px-4 text-right">
            {editing ? (
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1 rounded-lg bg-primary text-onPrimary text-xs font-semibold hover:bg-primaryDark disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => onEdit(item)}
                  className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary">
                  Edit
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary">
                  Adjust stock
                </button>
              </div>
            )}
          </td>
        )}
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={isAdmin ? 6 : 5} className="px-4 pb-4">
            <CylinderBrandForm
              editing={item}
              onSaved={() => {
                onCancelEdit();
                onUpdated();
              }}
              onCancel={onCancelEdit}
            />
          </td>
        </tr>
      )}
    </>
  );
}

export default function GasStockAdmin({ staffRole }) {
  const [stock, setStock] = useState([]);
  const [oversells, setOversells] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const isAdmin = staffRole === "admin";

  const loadStock = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [stockData, oversellData] = await Promise.all([
        getCylinderStockAdmin(),
        getOversellFlags(),
      ]);
      setStock(stockData);
      setOversells(oversellData);
    } catch (err) {
      setError(err.message || "Failed to load stock");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  const handleResolveOversell = async (flagId) => {
    try {
      await resolveOversellFlag(flagId);
      showToast("Flag resolved.");
      loadStock();
    } catch (err) {
      showToast(err.message || "Failed to resolve flag");
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const lowStockItems = stock.filter((s) => s.is_low_stock);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setExpandedId(item.cylinder_brand_id);
  };

  const closeForm = () => {
    setShowForm(false);
    setExpandedId(null);
    setEditing(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-textPrimary text-2xl font-bold">Gas Stock</h1>
          <p className="text-textSecondary text-sm mt-1">
            Cylinder inventory for this location
          </p>
        </div>
        <button
          onClick={loadStock}
          disabled={loading}
          className="px-4 py-2 rounded-xl border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors disabled:opacity-50">
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {toast && (
        <div className="mb-4 p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
          {toast}
        </div>
      )}

      {isAdmin && !showForm && (
        <button
          type="button"
          onClick={openCreate}
          className="mb-4 px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm">
          + Add cylinder brand
        </button>
      )}

      {isAdmin && showForm && (
        <>
          <CylinderBrandForm
            editing={editing}
            onSaved={() => {
              closeForm();
              loadStock();
            }}
            onCancel={closeForm}
          />
          <button
            type="button"
            onClick={closeForm}
            className="mt-3 px-4 py-2 rounded-lg border border-borderColor bg-surface2 text-textSecondary font-semibold text-sm hover:bg-surface3 hover:text-textPrimary">
            Cancel
          </button>
        </>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-medium">
          {error}
        </div>
      )}

      {lowStockItems.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/20">
          <p className="text-warning font-semibold text-sm mb-2">
            Low stock alerts ({lowStockItems.length})
          </p>
          <ul className="space-y-1">
            {lowStockItems.map((item) => (
              <li
                key={item.cylinder_brand_id}
                className="text-warning/80 text-sm">
                {item.brand} {item.weight_kg}kg — {item.filled_qty} filled
                (threshold: {item.low_stock_threshold})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-surface2 border border-borderColor overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-borderColor bg-surface1">
              <th className="py-3 px-4 text-left text-textSecondary text-xs font-semibold uppercase tracking-wide">
                Cylinder
              </th>
              <th className="py-3 px-4 text-center text-textSecondary text-xs font-semibold uppercase tracking-wide">
                Filled
              </th>
              <th className="py-3 px-4 text-center text-textSecondary text-xs font-semibold uppercase tracking-wide">
                Empty
              </th>
              <th className="py-3 px-4 text-center text-textSecondary text-xs font-semibold uppercase tracking-wide">
                Alert At
              </th>
              <th className="py-3 px-4 text-center text-textSecondary text-xs font-semibold uppercase tracking-wide">
                Status
              </th>
              {isAdmin && (
                <th className="py-3 px-4 text-right text-textSecondary text-xs font-semibold uppercase tracking-wide">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {stock.map((item) => (
              <StockRow
                key={item.stock_id}
                item={item}
                isAdmin={isAdmin}
                onToast={showToast}
                onUpdated={loadStock}
                onEdit={openEdit}
                isExpanded={expandedId === item.cylinder_brand_id}
                onCancelEdit={() => {
                  setExpandedId(null);
                  setEditing(null);
                }}
              />
            ))}
            {stock.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={isAdmin ? 6 : 5}
                  className="py-8 text-center text-textMuted text-sm">
                  No stock records found. Add cylinder brands first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-textMuted text-xs mt-4">
        Last updated:{" "}
        {stock[0]?.updated_at
          ? new Date(stock[0].updated_at).toLocaleString()
          : "—"}
      </p>

      {oversells.length > 0 && (
        <div className="mt-8">
          <h2 className="text-textPrimary text-lg font-bold mb-3">
            Oversell flags ({oversells.length})
          </h2>
          <p className="text-textSecondary text-sm mb-4">
            Sales that exceeded available stock — review and reconcile.
          </p>
          <div className="rounded-2xl bg-surface2 border border-borderColor overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-borderColor bg-surface1">
                  <th className="py-3 px-4 text-left text-textSecondary text-xs font-semibold uppercase tracking-wide">
                    Item
                  </th>
                  <th className="py-3 px-4 text-center text-textSecondary text-xs font-semibold uppercase tracking-wide">
                    Requested
                  </th>
                  <th className="py-3 px-4 text-center text-textSecondary text-xs font-semibold uppercase tracking-wide">
                    Available
                  </th>
                  <th className="py-3 px-4 text-left text-textSecondary text-xs font-semibold uppercase tracking-wide">
                    Sale Date
                  </th>
                  {isAdmin && (
                    <th className="py-3 px-4 text-right text-textSecondary text-xs font-semibold uppercase tracking-wide">
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {oversells.map((flag) => {
                  const matchingStock = stock.find(
                    (s) => s.cylinder_brand_id === flag.cylinder_brand_id,
                  );
                  // Only cylinder stock is tracked on this page; for
                  // accessory oversells we can't verify client-side, so
                  // leave the button enabled and let the backend enforce it.
                  const stockAdjusted =
                    flag.item_type !== "cylinder" ||
                    (!!matchingStock?.updated_at &&
                      new Date(matchingStock.updated_at) >
                        new Date(flag.created_at));

                  return (
                    <tr
                      key={flag.id}
                      className="border-b border-borderColor last:border-0">
                      <td className="py-3 px-4">
                        <p className="text-textPrimary font-semibold text-sm">
                          {flag.item_name ||
                            `${flag.item_type} #${flag.cylinder_brand_id || flag.product_id}`}
                        </p>
                        <p className="text-textMuted text-xs">
                          Sale #{flag.sale_id}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-danger font-semibold text-sm">
                          {flag.requested}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-textSecondary text-sm">
                          {flag.available}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-textSecondary text-sm">
                          {new Date(flag.sale_date).toLocaleString()}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleResolveOversell(flag.id)}
                            disabled={!stockAdjusted}
                            title={
                              stockAdjusted
                                ? "Mark this oversell as reviewed"
                                : "Edit the stock quantity above to reflect the actual on-hand count before resolving"
                            }
                            className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary disabled:opacity-40 disabled:cursor-not-allowed">
                            Resolve
                          </button>
                          {!stockAdjusted && (
                            <p className="text-textMuted text-xs mt-1">
                              Adjust stock first
                            </p>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
