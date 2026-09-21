import { Fragment, useEffect, useMemo, useState, useCallback } from "react";
import {
  CTabs,
  CTabList,
  CTab,
  CTabContent,
  CTabPanel,
} from "@coreui/react";
import "@coreui/coreui/dist/css/coreui.min.css";
import {
  getProducts,
  createProduct,
  updateProduct,
  getCylinderStockAdmin,
  recordStockLoss,
  getOversellFlags,
  resolveOversellFlag,
  listLocations,
  listStockTransfers,
  createStockTransfer,
  getCylinderBrands,
  listRefillRequests,
  getRefillRequest,
  createRefillRequest,
  fulfillRefillRequest,
  cancelRefillRequest,
  listAnimalPurchases,
  getAnimalPurchase,
  createAnimalPurchase,
  slaughterAnimal,
  recordStockTake,
} from "../lib/api";
import CylinderBrandForm from "../components/CylinderBrandForm";
import GasRestockForm from "../components/GasRestockForm";
import ProductRestockForm from "../components/ProductRestockForm";
import { useActiveLocation } from "../contexts/LocationContext";

const businessOptions = ["butchery", "accessory"];
const inputClass =
  "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";

// Butchery products can draw from a shared stock pool instead of their own
// stock row — e.g. mixed beef, steak and mince all deduct from 'beef'.
const POOL_OPTIONS = [
  { value: "beef", label: "Beef — meat & bones (kg)" },
  { value: "organs", label: "Organs — liver, kidney, heart (kg)" },
  { value: "tongue", label: "Tongue (kg)" },
  { value: "matumbo", label: "Matumbo (kg)" },
  { value: "lungs", label: "Lungs (kg)" },
  { value: "heads", label: "Heads (pieces)" },
  { value: "legs", label: "Legs (pieces)" },
  { value: "goat", label: "Goat meat (kg)" },
  { value: "goat_organs", label: "Goat organs — liver, kidney, heart (kg)" },
  { value: "goat_tongue", label: "Goat tongue (kg)" },
  { value: "goat_matumbo", label: "Goat matumbo (kg)" },
  { value: "goat_lungs", label: "Goat lungs (kg)" },
  { value: "goat_heads", label: "Goat heads (pieces)" },
  { value: "goat_legs", label: "Goat legs (pieces)" },
];

function ProductForm({ editing, onSaved, onCancel }) {
  const { activeLocationId } = useActiveLocation();
  const defaults = editing || {
    name: "",
    business_type: "butchery",
    pricing_type: "fixed",
    unit_price: "",
    track_stock: false,
    low_stock_threshold: "0",
    qty_on_hand: "0",
    is_active: true,
  };

  const [name, setName] = useState(defaults.name || "");
  const [businessType, setBusinessType] = useState(
    defaults.business_type || "butchery",
  );
  const [pricingType, setPricingType] = useState(
    defaults.pricing_type || "fixed",
  );
  const [unitPrice, setUnitPrice] = useState(defaults.unit_price ?? "");
  const [trackStock, setTrackStock] = useState(Boolean(defaults.track_stock));
  const [lowStockThreshold, setLowStockThreshold] = useState(
    defaults.low_stock_threshold ?? defaults.reorder_threshold ?? "0",
  );
  const [qtyOnHand, setQtyOnHand] = useState(defaults.qty_on_hand ?? "0");
  const [isActive, setIsActive] = useState(Boolean(defaults.is_active));
  const [poolKey, setPoolKey] = useState(defaults.pool_key || "");
  const [stockTakeCost, setStockTakeCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Quantity added above the current count — can carry a cost (posted as an
  // opening-stock expense).
  const previewAdded = trackStock && !poolKey
    ? Math.max(0, Number(qtyOnHand || 0) - Number(editing?.qty_on_hand || 0))
    : 0;

  useEffect(() => {
    if (editing) {
      setName(editing.name || "");
      setBusinessType(editing.business_type || "butchery");
      setPricingType(editing.pricing_type || "fixed");
      setUnitPrice(editing.unit_price ?? "");
      setTrackStock(Boolean(editing.track_stock));
      setLowStockThreshold(
        editing.low_stock_threshold ?? editing.reorder_threshold ?? "0",
      );
      setQtyOnHand(editing.qty_on_hand ?? "0");
      setIsActive(Boolean(editing.is_active));
      setPoolKey(editing.pool_key || "");
    }
  }, [editing]);

  const submit = async () => {
    if (!name.trim()) {
      setError("Product name is required");
      return;
    }

    const parsedPrice = Number.parseFloat(unitPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Valid unit price is required");
      return;
    }

    setSaving(true);
    setError("");

    // Quantity added above the current count with a cost posts an
    // opening-stock expense; pool products are stocked via slaughter records
    // and never take manual quantities.
    const baseQty = editing ? Number(editing.qty_on_hand || 0) : 0;
    const newQty = trackStock ? Number(qtyOnHand || 0) : 0;
    const addedQty = Math.max(0, newQty - baseQty);
    // Added stock always has a cost — require it so stock can't enter the
    // books valueless; reductions are count corrections.
    if (addedQty > 0 && !(Number(stockTakeCost) > 0)) {
      setError("Enter what each added unit cost — added stock is an expense");
      return;
    }
    const capturesExpense = addedQty > 0 && !poolKey;

    try {
      const payload = {
        name: name.trim(),
        business_type: businessType,
        pricing_type: pricingType,
        unit_price: parsedPrice,
        track_stock: trackStock,
        low_stock_threshold: trackStock ? Number(lowStockThreshold || 0) : 0,
        qty_on_hand: capturesExpense ? baseQty : newQty,
        is_active: isActive,
        pool_key: businessType === "butchery" && poolKey ? poolKey : null,
      };

      let productId = editing?.id;
      if (editing) {
        await updateProduct(editing.id, payload, activeLocationId);
      } else {
        const created = await createProduct(payload, activeLocationId);
        productId = created.id;
      }

      if (capturesExpense) {
        await recordStockTake({
          location_id: activeLocationId,
          payment_method: "cash",
          lines: [{ kind: "product", product_id: productId, quantity: addedQty, unit_cost: Number(stockTakeCost) }],
        });
      }

      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-2xl bg-surface2 border border-borderColor p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-textPrimary text-sm font-semibold">
          {editing ? "Edit product" : "Add product"}
        </p>
        {editing && (
          <button
            type="button"
            onClick={onCancel}
             className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary">
            Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="text-textMuted text-xs block mb-1">
            Product name
          </label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="text-textMuted text-xs block mb-1">
            Business type
          </label>
          <select
            className={inputClass}
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}>
            {businessOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-textMuted text-xs block mb-1">
            Pricing type
          </label>
          <select
            className={inputClass}
            value={pricingType}
            onChange={(e) => setPricingType(e.target.value)}>
            <option value="fixed">Fixed (whole units, e.g. per piece)</option>
            <option value="weighted">Fractionable (e.g. sold per kg)</option>
          </select>
        </div>

        <div>
          <label className="text-textMuted text-xs block mb-1">
            Unit price
          </label>
          <input
            className={inputClass}
            type="number"
            min="0"
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </div>

        {businessType === "butchery" && (
          <div>
            <label className="text-textMuted text-xs block mb-1">
              Stock pool
            </label>
            <select
              className={inputClass}
              value={poolKey}
              onChange={(e) => setPoolKey(e.target.value)}>
              <option value="">No pool (untracked / own stock)</option>
              {POOL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {poolKey && (
              <p className="text-textMuted text-xs mt-1">
                Sales deduct from this branch's shared {poolKey} pool — quantity comes from slaughter records, not this form.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 pt-5">
          <label className="flex items-center gap-2 text-xs text-textSecondary">
            <input
              type="checkbox"
              checked={trackStock}
              onChange={(e) => setTrackStock(e.target.checked)}
            />
            Track stock
          </label>
          <label className="flex items-center gap-2 text-xs text-textSecondary">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
        </div>

        {trackStock && !poolKey && (
          <>
            <div>
              <label className="text-textMuted text-xs block mb-1">
                Current stock
              </label>
              <input
                className={inputClass}
                type="number"
                min="0"
                value={qtyOnHand}
                onChange={(e) => setQtyOnHand(e.target.value)}
              />
            </div>

            <div>
              <label className="text-textMuted text-xs block mb-1">
                Low stock threshold
              </label>
              <input
                className={inputClass}
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
              />
            </div>

            {previewAdded > 0 && (
              <div className="md:col-span-2">
                <label className="text-textMuted text-xs block mb-1">
                  Cost per added unit — {previewAdded} added (KES)
                </label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={stockTakeCost}
                  onChange={(e) => setStockTakeCost(e.target.value)}
                  placeholder="Required — what you paid per unit"
                />
                <p className="text-textMuted text-xs mt-1">
                  The added quantity posts an opening-stock expense and sets
                  the stock's average cost. Reducing the count is a
                  correction — no expense.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {error && <p className="text-danger text-xs font-semibold">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold disabled:opacity-50">
          {saving
            ? editing
              ? "Updating..."
              : "Creating..."
            : editing
              ? "Update product"
              : "Create product"}
        </button>
      </div>
    </form>
  );
}

function ProductTableRow({ product, isExpanded, onEdit, onSaved, onCancel }) {
  const isLow =
    product.track_stock &&
    Number(product.qty_on_hand || 0) <=
      Number(product.low_stock_threshold || 0);

  return (
    <>
      <tr className="border-b border-borderColor last:border-0">
        <td className="py-3 px-4">
          <p className="text-textPrimary font-semibold text-sm">
            {product.name}
          </p>
          {!product.is_active && (
            <span className="text-xs text-danger">Inactive</span>
          )}
        </td>
        <td className="py-3 px-4">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">
            {product.business_type}
          </span>
          <p className="text-textMuted text-xs mt-1">{product.pricing_type}</p>
        </td>
        <td className="py-3 px-4 text-center text-textPrimary text-sm">
          {Number(product.unit_price || 0).toFixed(2)}
        </td>
        <td className="py-3 px-4 text-center text-sm">
          {product.pool_key ? (
            product.pool_unit ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success">
                {Number(product.qty_on_hand || 0)} {product.pool_unit === "piece" ? "pcs" : "kg"}
              </span>
            ) : (
              <span className="text-textMuted">not stocked</span>
            )
          ) : product.track_stock ? (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isLow
                  ? "bg-warning/10 text-warning"
                  : "bg-success/10 text-success"
              }`}>
              {Number(product.qty_on_hand || 0)}
            </span>
          ) : (
            <span className="text-textMuted">—</span>
          )}
        </td>
        <td className="py-3 px-4 text-center text-textMuted text-sm">
          {product.track_stock
            ? Number(product.low_stock_threshold || 0)
            : "—"}
        </td>
        <td className="py-3 px-4 text-center">
          {product.pool_key ? (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">
              Pool: {product.pool_key}
            </span>
          ) : product.track_stock ? (
            <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] font-semibold uppercase tracking-wide">
              Stock tracked
            </span>
          ) : null}
        </td>
        <td className="py-3 px-4 text-right">
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-1.5 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3">
            Edit
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-4 pb-4">
            <ProductForm
              editing={product}
              onSaved={onSaved}
              onCancel={onCancel}
            />
          </td>
        </tr>
      )}
    </>
  );
}




function GasStockRow({
  item,
  isAdmin,
  onToast,
  onUpdated,
  onEdit,
  isExpanded,
  onCancelEdit,
  activeLocationId,
}) {
  const [declaring, setDeclaring] = useState(false);
  const [filledLost, setFilledLost] = useState("0");
  const [emptyLost, setEmptyLost] = useState("0");
  const [lossNote, setLossNote] = useState("");
  const [saving, setSaving] = useState(false);

  const filledN = Math.max(0, parseInt(filledLost || "0", 10) || 0);
  const emptyN = Math.max(0, parseInt(emptyLost || "0", 10) || 0);
  const lossValue = filledN * Number(item.filled_avg_cost || 0) + emptyN * Number(item.empty_avg_cost || 0);
  const lossValid = filledN <= item.filled_qty && emptyN <= item.empty_qty && (filledN > 0 || emptyN > 0);

  const handleDeclare = async () => {
    if (!lossValid) return;
    setSaving(true);
    try {
      const result = await recordStockLoss({
        location_id: activeLocationId,
        cylinder_brand_id: item.cylinder_brand_id,
        filled_qty: filledN,
        empty_qty: emptyN,
        notes: lossNote || undefined,
      });
      onToast(`Loss declared — KES ${Number(result.loss_value).toLocaleString("en-KE")} written off.`);
      setDeclaring(false);
      setFilledLost("0");
      setEmptyLost("0");
      setLossNote("");
      onUpdated();
    } catch (err) {
      onToast(err.message || "Failed to declare loss");
    } finally {
      setSaving(false);
    }
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
        </td>
        <td className="py-3 px-4 text-center">
          <span className="text-textSecondary text-sm">{item.empty_qty}</span>
        </td>
        <td className="py-3 px-4 text-center">
          <span className="text-textMuted text-sm">
            {item.low_stock_threshold}
          </span>
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
            <div className="flex justify-end gap-2 flex-wrap">
              <button
                onClick={() => onEdit(item)}
                className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary">
                Edit
              </button>
              <button
                onClick={() => setDeclaring((v) => !v)}
                className="px-3 py-1 rounded-lg border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/10">
                {declaring ? "Cancel loss" : "Declare loss"}
              </button>
            </div>
          </td>
        )}
      </tr>

      {declaring && (
        <tr>
          <td colSpan={isAdmin ? 6 : 5} className="px-4 pb-4 bg-surface1">
            <div className="flex flex-wrap items-end gap-3 pt-2">
              <label className="text-xs text-textSecondary">
                Filled lost (have {item.filled_qty})
                <input
                  className={`${inputClass} mt-1 w-28`}
                  type="number" min="0" max={item.filled_qty} step="1"
                  value={filledLost}
                  onChange={(e) => setFilledLost(e.target.value)}
                  disabled={saving}
                />
              </label>
              <label className="text-xs text-textSecondary">
                Empty lost (have {item.empty_qty})
                <input
                  className={`${inputClass} mt-1 w-28`}
                  type="number" min="0" max={item.empty_qty} step="1"
                  value={emptyLost}
                  onChange={(e) => setEmptyLost(e.target.value)}
                  disabled={saving}
                />
              </label>
              <label className="text-xs text-textSecondary flex-1 min-w-40">
                Note (damaged, stolen, missing…)
                <input
                  className={`${inputClass} mt-1`}
                  value={lossNote}
                  onChange={(e) => setLossNote(e.target.value)}
                  maxLength={200}
                  disabled={saving}
                />
              </label>
              <div className="text-xs text-textSecondary pb-2">
                Write-off value:{" "}
                <span className="font-bold text-danger">
                  KES {lossValue.toLocaleString("en-KE")}
                </span>
              </div>
              <button
                type="button"
                onClick={handleDeclare}
                disabled={saving || !lossValid}
                className="px-4 py-2 rounded-lg bg-danger text-white text-xs font-semibold disabled:opacity-50">
                {saving ? "Declaring…" : "Confirm loss"}
              </button>
            </div>
            <p className="text-textMuted text-xs mt-1">
              A complete cylinder = 1 filled + 1 empty. Both quantities deduct from stock and post a stock-loss expense at average cost.
            </p>
          </td>
        </tr>
      )}

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

function CatalogTab({ staffRole }) {
  const { activeLocationId } = useActiveLocation();
  const [products, setProducts] = useState([]);
  const [oversells, setOversells] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isAdmin = staffRole === "admin";

  const fetchProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const [rows, oversellData] = await Promise.all([
        getProducts(null, true, activeLocationId),
        getOversellFlags(false, activeLocationId),
      ]);
      setProducts(rows);
      // Butchery pool flags live here at the top of the list; cylinder
      // flags stay on the Gas Stock tab.
      setOversells((oversellData || []).filter((f) => f.item_type === "pool"));
    } catch (err) {
      setError(err.message || "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [activeLocationId]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesText =
        !term ||
        (product.name || "").toLowerCase().includes(term) ||
        (product.business_type || "").toLowerCase().includes(term);
      const matchesFilter =
        filter === "all" || product.business_type === filter;
      return matchesText && matchesFilter;
    });
  }, [products, filter, search]);

  const openCreate = () => {
    setEditingProduct(null);
    setExpandedId(null);
    setShowForm(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setExpandedId(product.id);
    setShowForm(false);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setExpandedId(null);
  };

  const closeInlineEdit = () => {
    setEditingProduct(null);
    setExpandedId(null);
  };

  // Pool oversells are a counting discrepancy, not a missing physical item —
  // they resolve on review without needing a stock adjustment first.
  const handleResolveOversell = async (flagId) => {
    try {
      await resolveOversellFlag(flagId);
      fetchProducts();
    } catch (err) {
      setError(err.message || "Failed to resolve flag");
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 text-danger px-3 py-2 text-xs font-medium">
          {error}
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm">
          + Add product
        </button>
      )}

      {showForm && (
        <>
          <ProductForm
            editing={editingProduct}
            onSaved={() => {
              closeForm();
              fetchProducts();
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

      {oversells.length > 0 && (
        <div className="rounded-2xl bg-surface2 border border-danger/30 overflow-hidden">
          <div className="px-4 py-3 bg-danger/10 border-b border-danger/20">
            <h3 className="text-danger text-sm font-bold">
              Oversell flags ({oversells.length})
            </h3>
            <p className="text-textMuted text-xs mt-0.5">
              Pool items sold past recorded stock — usually a counting discrepancy.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                {oversells.map((flag) => (
                  <tr key={flag.id} className="border-b border-borderColor last:border-0">
                    <td className="py-2.5 px-4">
                      <p className="text-textPrimary font-semibold text-sm">
                        {flag.display_name || flag.item_name || `Pool #${flag.pool_key || flag.id}`}
                      </p>
                      <p className="text-textMuted text-xs">Sale #{flag.sale_id} · {new Date(flag.sale_date).toLocaleString()}</p>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="text-danger font-semibold text-sm">{flag.requested}</span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="text-textSecondary text-sm">{flag.available}</span>
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleResolveOversell(flag.id)}
                          title="Mark this oversell as reviewed"
                          className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary">
                          Resolve
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-surface2 border border-borderColor p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <input
            className={inputClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
          />
          <select
            className={inputClass}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All business types</option>
            {businessOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-textMuted text-xs">Loading catalog...</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-borderColor">
            <table className="w-full">
              <thead>
                <tr className="border-b border-borderColor bg-surface1">
                  <th className="py-3 px-4 text-left text-textSecondary text-xs font-semibold uppercase tracking-wide">
                    Product
                  </th>
                  <th className="py-3 px-4 text-left text-textSecondary text-xs font-semibold uppercase tracking-wide">
                    Type
                  </th>
                  <th className="py-3 px-4 text-center text-textSecondary text-xs font-semibold uppercase tracking-wide">
                    Price
                  </th>
                  <th className="py-3 px-4 text-center text-textSecondary text-xs font-semibold uppercase tracking-wide">
                    Stock
                  </th>
                  <th className="py-3 px-4 text-center text-textSecondary text-xs font-semibold uppercase tracking-wide">
                    Threshold
                  </th>
                  <th className="py-3 px-4 text-center text-textSecondary text-xs font-semibold uppercase tracking-wide">
                    Status
                  </th>
                  <th className="py-3 px-4 text-right text-textSecondary text-xs font-semibold uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-textMuted text-sm">
                      No products match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <ProductTableRow
                      key={product.id}
                      product={product}
                      isExpanded={expandedId === product.id}
                      onEdit={() => openEdit(product)}
                      onSaved={() => {
                        closeInlineEdit();
                        fetchProducts();
                      }}
                      onCancel={closeInlineEdit}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function GasStockTab({ staffRole }) {
  const { activeLocationId } = useActiveLocation();
  const [stock, setStock] = useState([]);
  const [oversells, setOversells] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState("stock"); // 'stock' | 'restock'
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
        getCylinderStockAdmin(activeLocationId),
        getOversellFlags(false, activeLocationId),
      ]);
      setStock(stockData);
      // Cylinder flags only — butchery pool flags live on the Catalog tab.
      setOversells((oversellData || []).filter((f) => f.item_type === "cylinder"));
    } catch (err) {
      setError(err.message || "Failed to load stock");
    } finally {
      setLoading(false);
    }
  }, [activeLocationId]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleResolveOversell = async (flagId) => {
    try {
      await resolveOversellFlag(flagId);
      showToast("Flag resolved.");
      loadStock();
    } catch (err) {
      showToast(err.message || "Failed to resolve flag");
    }
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

  const viewToggle = (value, label) => (
    <button
      type="button"
      onClick={() => setView(value)}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
        view === value
          ? "bg-primary text-onPrimary border-primary"
          : "bg-surface1 text-textSecondary border-borderColor hover:bg-surface3 hover:text-textPrimary"
      }`}>
      {label}
    </button>
  );

  if (isAdmin && view === "restock") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 justify-between">
          {viewToggle("stock", "Stock on hand")}
          {viewToggle("restock", "Restock")}
        </div>
        <RestockTab />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
          {toast}
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap gap-2 justify-between">
          {viewToggle("stock", "Stock on hand")}
          {viewToggle("restock", "Restock")}
        </div>
      )}

      {isAdmin && !showForm && (
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm">
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
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-medium">
          {error}
        </div>
      )}

      {lowStockItems.length > 0 && (
        <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
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

      <div className="rounded-2xl bg-surface2 border border-borderColor overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[720px]">
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
            {loading ? (
              <tr>
                <td
                  colSpan={isAdmin ? 6 : 5}
                  className="py-8 text-center text-textMuted text-sm">
                  Loading gas stock...
                </td>
              </tr>
            ) : (
              stock.map((item) => (
                <GasStockRow
                  key={item.stock_id}
                  item={item}
                  isAdmin={isAdmin}
                  onToast={showToast}
                  onUpdated={loadStock}
                  onEdit={openEdit}
                  activeLocationId={activeLocationId}
                  isExpanded={expandedId === item.cylinder_brand_id}
                  onCancelEdit={() => {
                    setExpandedId(null);
                    setEditing(null);
                  }}
                />
              ))
            )}
            {!loading && stock.length === 0 && (
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

      <p className="text-textMuted text-xs">
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
                          {flag.display_name || flag.item_name ||
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
                                : "Record a refill or purchase that covers the unresolved shortage before resolving"
                            }
                            className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary disabled:opacity-40 disabled:cursor-not-allowed">
                            Resolve
                          </button>
                          {!stockAdjusted && (
                            <p className="text-textMuted text-xs mt-1">
                              Refill or purchase first
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

function RestockTab() {
  const { activeLocationId } = useActiveLocation();
  const [mode, setMode] = useState("cylinders");
  const [stock, setStock] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStock = useCallback(async () => {
    if (!activeLocationId) return;
    setLoading(true);
    setError("");
    try {
      const [cylinderData, productData] = await Promise.all([
        getCylinderStockAdmin(activeLocationId),
        getProducts("accessory", false, activeLocationId),
      ]);
      setStock(cylinderData || []);
      setAccessories((productData || []).filter((p) => p.track_stock));
    } catch (err) {
      setError(err.message || "Failed to load stock");
    } finally {
      setLoading(false);
    }
  }, [activeLocationId]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  if (!activeLocationId) {
    return (
      <div className="p-3">
        <p className="text-warning text-sm">Select a specific shop above to record a restock.</p>
      </div>
    );
  }

  const toggleClass = (active) =>
    `px-3 py-1.5 rounded-lg text-sm font-semibold border ${active
      ? "bg-primary text-onPrimary border-primary"
      : "bg-surface1 text-textSecondary border-borderColor hover:bg-surface3 hover:text-textPrimary"}`;

  return (
    <div className="p-3 space-y-4 max-w-4xl">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode("cylinders")} className={toggleClass(mode === "cylinders")}>
          Gas cylinders
        </button>
        <button type="button" onClick={() => setMode("accessories")} className={toggleClass(mode === "accessories")}>
          Gas accessories
        </button>
      </div>
      {loading && <p className="text-textMuted text-sm">Loading stock…</p>}
      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-medium">
          {error}
        </div>
      )}
      {mode === "cylinders" ? (
        <GasRestockForm locationId={activeLocationId} stock={stock} onSuccess={loadStock} />
      ) : accessories.length === 0 && !loading ? (
        <p className="text-textMuted text-sm">
          No stock-tracked accessory products yet. Add one under the Catalog tab with "Track stock" enabled.
        </p>
      ) : (
        <ProductRestockForm locationId={activeLocationId} products={accessories} onSuccess={loadStock} />
      )}
    </div>
  );
}

function StockTransfersTab({ staffRole }) {
  const { activeLocationId } = useActiveLocation();
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [cylinders, setCylinders] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [destinationId, setDestinationId] = useState("");
  const emptyLine = { item_type: "product", item_id: "", quantity: "" };
  const [lines, setLines] = useState([emptyLine]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const canTransfer = staffRole === "admin" || staffRole === "supervisor";
  const sourceLocation = locations.find((location) => String(location.id) === String(activeLocationId));
  const destinations = locations.filter((location) =>
    location.is_active && String(location.id) !== String(activeLocationId) &&
    (sourceLocation?.is_stock_store || location.is_stock_store),
  );
  const trackedProducts = products.filter((product) => product.track_stock);
  const itemsFor = (type) => (type === "product" ? trackedProducts : cylinders);
  const availableFor = (line) => {
    if (line.item_type === "product") return Number(trackedProducts.find((p) => String(p.id) === String(line.item_id))?.qty_on_hand || 0);
    const cyl = cylinders.find((c) => String(c.cylinder_brand_id) === String(line.item_id));
    return Number((line.item_type === "cylinder_filled" ? cyl?.filled_qty : cyl?.empty_qty) || 0);
  };
  const updateLine = (index, patch) => setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const removeLine = (index) => setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  const validateLines = () => {
    const seen = new Set();
    for (const [i, line] of lines.entries()) {
      const qty = Number(line.quantity);
      if (!line.item_id) return `Select an item on line ${i + 1}`;
      if (!Number.isInteger(qty) || qty <= 0) return `Quantity on line ${i + 1} must be a positive whole number`;
      if (qty > availableFor(line)) return `Line ${i + 1}: only ${availableFor(line)} available`;
      const key = `${line.item_type}:${line.item_id}`;
      if (seen.has(key)) return `Line ${i + 1} duplicates an earlier line`;
      seen.add(key);
    }
    return "";
  };
  const lineError = validateLines();

  const load = useCallback(async () => {
    if (!activeLocationId) return;
    setLoading(true);
    try {
      const [locationRows, productRows, cylinderRows, transferRows] = await Promise.all([
        listLocations(),
        getProducts(null, false, activeLocationId),
        getCylinderStockAdmin(activeLocationId),
        listStockTransfers(activeLocationId),
      ]);
      setLocations(locationRows || []);
      setProducts(productRows || []);
      setCylinders(cylinderRows || []);
      setTransfers(transferRows || []);
    } catch (err) {
      setMessage(err.message || "Failed to load stock transfers");
    } finally {
      setLoading(false);
    }
  }, [activeLocationId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    if (saving || !destinationId) return;
    const problem = validateLines();
    if (problem) { setMessage(problem); return; }
    setSaving(true);
    setMessage("");
    try {
      await createStockTransfer({
        source_location_id: Number(activeLocationId),
        destination_location_id: Number(destinationId),
        notes,
        lines: lines.map((line) => (line.item_type === "product"
          ? { item_type: "product", product_id: Number(line.item_id), quantity: Number(line.quantity) }
          : { item_type: line.item_type, cylinder_brand_id: Number(line.item_id), quantity: Number(line.quantity) })),
      });
      setLines([emptyLine]);
      setNotes("");
      setMessage(`Transferred ${lines.length} line${lines.length === 1 ? "" : "s"} successfully.`);
      await load();
    } catch (err) {
      setMessage(err.message || "Failed to transfer stock");
    } finally {
      setSaving(false);
    }
  };

  if (!canTransfer) return <p className="text-danger text-sm">Only admins and supervisors can transfer stock.</p>;
  if (loading) return <p className="text-textSecondary text-sm">Loading transfers…</p>;

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="rounded-xl border border-borderColor bg-surface2 p-4 space-y-4">
        <div>
          <h2 className="text-textPrimary font-bold">Transfer stock</h2>
          <p className="text-textMuted text-xs mt-1">Transfers are online-only, atomic, and recorded at both locations.</p>
        </div>
        {message && <p className="text-sm text-warning">{message}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-textSecondary">From
            <input className={`${inputClass} mt-1`} value={sourceLocation?.name || "Selected shop"} disabled />
          </label>
          <label className="text-xs text-textSecondary">To
            <select className={`${inputClass} mt-1`} value={destinationId} onChange={(event) => setDestinationId(event.target.value)} required disabled={saving}>
              <option value="">Select destination</option>
              {destinations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.is_stock_store ? " (Store)" : ""}</option>)}
            </select>
          </label>
        </div>

        <div className="space-y-3">
          <label className="text-textMuted text-xs">Transfer lines</label>
          {lines.map((line, index) => {
            const items = itemsFor(line.item_type);
            const available = line.item_id ? availableFor(line) : null;
            return (
              <div key={index} className="p-3 rounded-xl bg-surface1 border border-borderColor space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr,2fr,auto] gap-3">
                  <label className="text-xs text-textSecondary">Stock type
                    <select className={`${inputClass} mt-1`} value={line.item_type} onChange={(event) => updateLine(index, { item_type: event.target.value, item_id: "" })} disabled={saving}>
                      <option value="product">Tracked product</option>
                      <option value="cylinder_filled">Filled cylinder</option>
                      <option value="cylinder_empty">Empty cylinder</option>
                    </select>
                  </label>
                  <label className="text-xs text-textSecondary">Item
                    <select className={`${inputClass} mt-1`} value={line.item_id} onChange={(event) => updateLine(index, { item_id: event.target.value })} required disabled={saving}>
                      <option value="">Select item</option>
                      {items.map((item) => (
                        <option key={line.item_type === "product" ? item.id : item.cylinder_brand_id} value={line.item_type === "product" ? item.id : item.cylinder_brand_id}>
                          {line.item_type === "product" ? `${item.name} (${Number(item.qty_on_hand || 0)} available)` : `${item.brand} ${item.weight_kg}kg (${Number(line.item_type === "cylinder_filled" ? item.filled_qty : item.empty_qty)} available)`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-textSecondary">Quantity
                    <input className={`${inputClass} mt-1 sm:w-28`} type="number" min="1" step="1" max={available ?? undefined} value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} required disabled={saving} />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {available !== null && <span className="text-textSecondary text-xs mr-auto">{available} available at {sourceLocation?.name || "this shop"}</span>}
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(index)} disabled={saving} className="px-2 py-1 rounded-lg border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/10">Remove line</button>
                  )}
                  {index === lines.length - 1 && (
                    <button type="button" onClick={() => setLines((prev) => [...prev, emptyLine])} disabled={saving} className="px-2 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3">+ Add line</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <label className="text-xs text-textSecondary block">Notes
          <input className={`${inputClass} mt-1`} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} disabled={saving} />
        </label>
        {destinations.length === 0 && <p className="text-warning text-xs">Mark this shop or another active shop as a Stock store under Settings → Shops before transferring.</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving || destinations.length === 0 || !destinationId || Boolean(lineError)} className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold disabled:opacity-50">
            {saving ? "Transferring…" : `Transfer ${lines.length} line${lines.length === 1 ? "" : "s"}`}
          </button>
          {lineError && lines.some((l) => l.item_id && l.quantity) && <span className="text-xs text-warning">{lineError}</span>}
        </div>
      </form>

      <div className="rounded-xl border border-borderColor overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface2 text-textSecondary"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">From</th><th className="p-3 text-left">To</th><th className="p-3 text-left">Staff</th><th className="p-3 text-right">Lines</th></tr></thead>
          <tbody>
            {transfers.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-textMuted">No transfers involving this shop.</td></tr> : transfers.map((transfer) => (
              <tr key={transfer.id} className="border-t border-borderColor text-textPrimary">
                <td className="p-3 whitespace-nowrap">{new Date(transfer.created_at).toLocaleString("en-KE")}</td>
                <td className="p-3">{transfer.source_location_name}</td>
                <td className="p-3">{transfer.destination_location_name}</td>
                <td className="p-3">{transfer.staff_name}</td>
                <td className="p-3 text-right">{transfer.line_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const requestStatusBadge = {
  pending: "bg-warning/15 text-warning",
  in_progress: "bg-primary/15 text-primary",
  fulfilled: "bg-success/15 text-success",
  cancelled: "bg-danger/15 text-danger",
};

function RefillRequestDetail({ request, onAction, actionBusy, errorMessage }) {
  const [leg, setLeg] = useState(request.has_empties_leg ? "empties" : "filled");
  const [quantities, setQuantities] = useState({});
  const [notes, setNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const isOpen = request.status === "pending" || request.status === "in_progress";
  const counter = leg === "empties" ? "empties_sent_qty" : "filled_received_qty";
  const legLines = request.lines.map((line) => ({
    ...line,
    entered: Number(quantities[line.cylinder_brand_id] || 0),
  }));
  const totalEntered = legLines.reduce((sum, line) => sum + line.entered, 0);
  const sourceName = leg === "empties" ? request.requesting_location_name : request.stock_store_location_name;
  const destinationName = leg === "empties" ? request.stock_store_location_name : request.requesting_location_name;

  const submitLeg = () => {
    const lines = legLines
      .filter((line) => line.entered > 0)
      .map((line) => ({ cylinder_brand_id: line.cylinder_brand_id, quantity: line.entered }));
    if (lines.length === 0) return;
    onAction(() => fulfillRefillRequest(request.id, { leg, lines, notes: notes || undefined }));
    setQuantities({});
    setNotes("");
  };

  return (
    <div className="p-3 sm:p-4 bg-surface1 space-y-4">
      <div className="overflow-x-auto rounded-lg border border-borderColor">
        <table className="w-full text-sm">
          <thead className="bg-surface2 text-textSecondary">
            <tr>
              <th className="p-2 text-left">Brand</th>
              <th className="p-2 text-right">Requested</th>
              {request.has_empties_leg ? <th className="p-2 text-right">Empties sent</th> : null}
              <th className="p-2 text-right">Filled received</th>
            </tr>
          </thead>
          <tbody>
            {request.lines.map((line) => (
              <tr key={line.id} className="border-t border-borderColor text-textPrimary">
                <td className="p-2">{line.brand} {line.weight_kg}kg</td>
                <td className="p-2 text-right">{line.requested_qty}</td>
                {request.has_empties_leg ? <td className="p-2 text-right">{line.empties_sent_qty}</td> : null}
                <td className="p-2 text-right">{line.filled_received_qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <div className="rounded-lg border border-borderColor bg-surface2 p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-textSecondary font-semibold">Record leg:</span>
            {request.has_empties_leg ? (
              <label className="text-xs text-textPrimary flex items-center gap-1">
                <input type="radio" checked={leg === "empties"} onChange={() => setLeg("empties")} />
                Empties ({request.requesting_location_name} → {request.stock_store_location_name})
              </label>
            ) : null}
            <label className="text-xs text-textPrimary flex items-center gap-1">
              <input type="radio" checked={leg === "filled"} onChange={() => setLeg("filled")} />
              Filled ({request.stock_store_location_name} → {request.requesting_location_name})
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {legLines.map((line) => (
              <label key={line.cylinder_brand_id} className="text-xs text-textSecondary flex items-center gap-2">
                <span className="flex-1">{line.brand} {line.weight_kg}kg
                  <span className="text-textMuted"> ({line.requested_qty - Number(line[counter])} outstanding)</span>
                </span>
                <input
                  className={`${inputClass} w-20`} type="number" min="0" step="1"
                  value={quantities[line.cylinder_brand_id] ?? ""}
                  placeholder="0"
                  onChange={(event) => setQuantities((prev) => ({ ...prev, [line.cylinder_brand_id]: event.target.value === "" ? "" : Number(event.target.value) }))}
                  disabled={actionBusy}
                />
              </label>
            ))}
          </div>
          <input className={inputClass} placeholder="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} disabled={actionBusy} />
          {errorMessage ? (
            <p className="text-danger text-xs font-semibold rounded-lg bg-danger/10 border border-danger/30 px-3 py-2">{errorMessage}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submitLeg}
              disabled={actionBusy || totalEntered <= 0}
              className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold disabled:opacity-50"
            >
              {actionBusy ? "Recording…" : `Record ${leg === "empties" ? "empties" : "filled"} transfer (${sourceName} → ${destinationName})`}
            </button>
            <button type="button" onClick={() => setShowCancel((prev) => !prev)} disabled={actionBusy} className="px-3 py-2 rounded-lg border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/10">
              Cancel request
            </button>
          </div>
          {showCancel && (
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${inputClass} flex-1 min-w-40`} placeholder="Reason (optional)" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={500} disabled={actionBusy} />
              <button
                type="button"
                onClick={() => onAction(() => cancelRefillRequest(request.id, cancelReason || undefined))}
                disabled={actionBusy}
                className="px-3 py-2 rounded-lg bg-danger text-white text-xs font-semibold disabled:opacity-50"
              >
                Confirm cancel
              </button>
            </div>
          )}
        </div>
      )}

      {request.cancel_reason ? <p className="text-danger text-xs">Cancelled: {request.cancel_reason}</p> : null}

      {request.events.length > 0 && (
        <div>
          <p className="text-textMuted text-xs font-semibold mb-1">History</p>
          <ul className="space-y-1">
            {request.events.map((event) => (
              <li key={event.id} className="text-xs text-textSecondary">
                {new Date(event.created_at).toLocaleString("en-KE")} — {event.staff_name}: {event.notes || event.event_type}
                {event.stock_transfer_id ? ` (transfer #${event.stock_transfer_id})` : ""}
                {event.expense_id ? ` (expense #${event.expense_id})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RefillRequestsTab({ staffRole }) {
  const { activeLocationId } = useActiveLocation();
  const [locations, setLocations] = useState([]);
  const [brands, setBrands] = useState([]);
  const [requestingStock, setRequestingStock] = useState([]);
  const [requests, setRequests] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [requestingId, setRequestingId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [hasEmptiesLeg, setHasEmptiesLeg] = useState(true);
  const emptyLine = { cylinder_brand_id: "", quantity: "" };
  const [lines, setLines] = useState([emptyLine]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const canManage = staffRole === "admin" || staffRole === "supervisor";
  const activeLocation = locations.find((location) => String(location.id) === String(activeLocationId));
  const isStockStore = Boolean(activeLocation?.is_stock_store);
  const stockStores = locations.filter((location) => location.is_active && location.is_stock_store);
  const effectiveRequestingId = isStockStore ? requestingId : String(activeLocationId || "");
  const storeChoices = stockStores.filter((location) => String(location.id) !== effectiveRequestingId);
  const effectiveStoreId = isStockStore ? String(activeLocationId || "") : storeId;
  const stockForBrand = (brandId) => requestingStock.find((s) => String(s.cylinder_brand_id) === String(brandId));

  const load = useCallback(async () => {
    if (!activeLocationId) return;
    setLoading(true);
    try {
      const [locationRows, brandRows, requestRows] = await Promise.all([
        listLocations(),
        getCylinderBrands(),
        listRefillRequests(),
      ]);
      setLocations(locationRows || []);
      setBrands((brandRows || []).filter((brand) => brand.is_active !== false));
      setRequests(requestRows || []);
    } catch (err) {
      setMessage(err.message || "Failed to load refill requests");
    } finally {
      setLoading(false);
    }
  }, [activeLocationId]);

  useEffect(() => { load(); }, [load]);

  // Balances for the request form's brand picker — the requesting shop's own
  // empty/filled counts, refreshed when the shop or form visibility changes.
  useEffect(() => {
    if (!showForm || !effectiveRequestingId) { setRequestingStock([]); return undefined; }
    let cancelled = false;
    getCylinderStockAdmin(Number(effectiveRequestingId))
      .then((rows) => { if (!cancelled) setRequestingStock(rows || []); })
      .catch(() => { if (!cancelled) setRequestingStock([]); });
    return () => { cancelled = true; };
  }, [showForm, effectiveRequestingId]);

  const toggleExpand = async (request) => {
    const id = request.id;
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!details[id]) {
      try {
        const detail = await getRefillRequest(id);
        setDetails((prev) => ({ ...prev, [id]: detail }));
      } catch (err) {
        setMessage(err.message || "Failed to load request detail");
      }
    }
  };

  const runAction = async (action) => {
    setSaving(true);
    setMessage("");
    try {
      const updated = await action();
      if (updated?.id) setDetails((prev) => ({ ...prev, [updated.id]: updated }));
      await load();
    } catch (err) {
      setMessage(err.message || "Action failed");
    } finally {
      setSaving(false);
    }
  };

  const updateLine = (index, patch) => setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const removeLine = (index) => setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const validateForm = () => {
    if (!effectiveRequestingId) return "Select the requesting shop";
    if (!effectiveStoreId) return "Select the stock store that will fulfill the request";
    const seen = new Set();
    for (const [i, line] of lines.entries()) {
      if (!line.cylinder_brand_id) return `Select a cylinder brand on line ${i + 1}`;
      const qty = Number(line.quantity);
      if (!Number.isInteger(qty) || qty <= 0) return `Quantity on line ${i + 1} must be a positive whole number`;
      if (seen.has(line.cylinder_brand_id)) return `Line ${i + 1} duplicates an earlier line`;
      seen.add(line.cylinder_brand_id);
    }
    return "";
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    const problem = validateForm();
    if (problem) { setMessage(problem); return; }
    setSaving(true);
    setMessage("");
    try {
      await createRefillRequest({
        requesting_location_id: Number(effectiveRequestingId),
        stock_store_location_id: Number(effectiveStoreId),
        has_empties_leg: hasEmptiesLeg,
        notes: notes || undefined,
        lines: lines.map((line) => ({ cylinder_brand_id: Number(line.cylinder_brand_id), quantity: Number(line.quantity) })),
      });
      setLines([emptyLine]);
      setNotes("");
      setHasEmptiesLeg(true);
      setRequestingId("");
      setStoreId("");
      setShowForm(false);
      setMessage("Refill request created.");
      await load();
    } catch (err) {
      setMessage(err.message || "Failed to create refill request");
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) return <p className="text-danger text-sm">Only admins and supervisors can manage refill requests.</p>;
  if (loading) return <p className="text-textSecondary text-sm">Loading refill requests…</p>;

  return (
    <div className="space-y-5">
      {message && <p className="text-sm text-warning">{message}</p>}

      {!showForm ? (
        <button type="button" onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold">
          + New refill request
        </button>
      ) : (
        <form onSubmit={submitRequest} className="rounded-xl border border-borderColor bg-surface2 p-4 space-y-4">
          <div>
            <h2 className="text-textPrimary font-bold">New refill request</h2>
            <p className="text-textMuted text-xs mt-1">
              Links the full round-trip — empties to the store, filled cylinders back — so both sides can track status.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-textSecondary">Requesting shop
              {isStockStore ? (
                <select className={`${inputClass} mt-1`} value={requestingId} onChange={(event) => setRequestingId(event.target.value)} required disabled={saving}>
                  <option value="">Select shop</option>
                  {locations.filter((location) => location.is_active && String(location.id) !== String(activeLocationId)).map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              ) : (
                <input className={`${inputClass} mt-1`} value={activeLocation?.name || "This shop"} disabled />
              )}
            </label>
            <label className="text-xs text-textSecondary">Fulfilling stock store
              {isStockStore ? (
                <input className={`${inputClass} mt-1`} value={activeLocation?.name || "This store"} disabled />
              ) : (
                <select className={`${inputClass} mt-1`} value={storeId} onChange={(event) => setStoreId(event.target.value)} required disabled={saving}>
                  <option value="">Select store</option>
                  {storeChoices.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              )}
            </label>
          </div>
          <label className="text-xs text-textPrimary flex items-center gap-2">
            <input type="checkbox" checked={hasEmptiesLeg} onChange={(event) => setHasEmptiesLeg(event.target.checked)} disabled={saving} />
            This request sends empty shells to the store for refill (uncheck for a filled-cylinders-only order)
          </label>

          <div className="space-y-3">
            <label className="text-textMuted text-xs">Cylinder lines</label>
            {lines.map((line, index) => (
              <div key={index} className="p-3 rounded-xl bg-surface1 border border-borderColor">
                <div className="grid grid-cols-1 sm:grid-cols-[2fr,auto] gap-3">
                  <label className="text-xs text-textSecondary">Brand
                    <select className={`${inputClass} mt-1`} value={line.cylinder_brand_id} onChange={(event) => updateLine(index, { cylinder_brand_id: event.target.value })} required disabled={saving}>
                      <option value="">Select brand</option>
                      {brands.map((brand) => {
                        const balance = stockForBrand(brand.id);
                        return (
                          <option key={brand.id} value={brand.id}>
                            {brand.brand} {brand.weight_kg}kg{balance ? ` (${Number(balance.empty_qty)} empty · ${Number(balance.filled_qty)} filled)` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="text-xs text-textSecondary">Quantity
                    <input className={`${inputClass} mt-1 sm:w-28`} type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} required disabled={saving} />
                  </label>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(index)} disabled={saving} className="px-2 py-1 rounded-lg border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/10">Remove line</button>
                  )}
                  {index === lines.length - 1 && (
                    <button type="button" onClick={() => setLines((prev) => [...prev, emptyLine])} disabled={saving} className="px-2 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3">+ Add line</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <label className="text-xs text-textSecondary block">Notes
            <input className={`${inputClass} mt-1`} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} disabled={saving} />
          </label>
          {stockStores.length === 0 && <p className="text-warning text-xs">No shop is marked as a Stock store — set one under Settings → Shops first.</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving || stockStores.length === 0 || Boolean(validateForm())} className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold disabled:opacity-50">
              {saving ? "Creating…" : "Create request"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setMessage(""); }} disabled={saving} className="px-3 py-2 rounded-lg border border-borderColor text-textSecondary text-xs font-semibold hover:bg-surface3">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-borderColor overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface2 text-textSecondary">
            <tr>
              <th className="p-3 text-left">Requested</th>
              <th className="p-3 text-left">From</th>
              <th className="p-3 text-left">Store</th>
              <th className="p-3 text-right">Cylinders</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-textMuted">No refill requests involving this shop.</td></tr>
            ) : requests.map((request) => (
              <Fragment key={request.id}>
                <tr
                  className="border-t border-borderColor text-textPrimary cursor-pointer hover:bg-surface1"
                  onClick={() => toggleExpand(request)}
                >
                  <td className="p-3 whitespace-nowrap">{new Date(request.created_at).toLocaleString("en-KE")}</td>
                  <td className="p-3">{request.requesting_location_name}</td>
                  <td className="p-3">{request.stock_store_location_name}</td>
                  <td className="p-3 text-right">{request.filled_received_qty}/{request.requested_qty}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${requestStatusBadge[request.status] || "bg-surface2 text-textSecondary"}`}>
                      {request.status.replace("_", " ")}
                    </span>
                    {request.has_empties_leg ? null : <span className="ml-1 text-textMuted text-xs">(filled only)</span>}
                  </td>
                </tr>
                {expandedId === request.id && (
                  <tr className="border-t border-borderColor">
                    <td colSpan={5} className="p-0">
                      {details[request.id] ? (
                        <RefillRequestDetail request={details[request.id]} onAction={runAction} actionBusy={saving} errorMessage={message} />
                      ) : (
                        <p className="p-4 text-textSecondary text-sm">Loading…</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const KG_OUTPUTS = [
  ["meat", "Meat & bones"],
  ["organs", "Organs (liver, kidney & heart)"],
  ["tripe", "Matumbo"],
  ["matumbo", "Mara"],
];
// Heads, legs, tongue and lungs sell bundled as one set per animal; the hide
// is a separate piece. Both are priced at slaughter.
const PIECE_OUTPUTS = [
  ["head_set", "Head, legs, tongue & lungs"],
  ["hide", "Hide"],
];

function LivestockTab() {
  const { activeLocationId } = useActiveLocation();
  const [animals, setAnimals] = useState([]);
  const [details, setDetails] = useState({});
  const [showBuy, setShowBuy] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [slaughteringId, setSlaughteringId] = useState(null);
  const [buyForm, setBuyForm] = useState({ animal_type: "cattle", reference: "", total_cost: "", supplier_name: "", payment_method: "cash", expense_date: "", notes: "" });
  const [extras, setExtras] = useState([]);
  const [slaughterForm, setSlaughterForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!activeLocationId) return;
    setLoading(true);
    try {
      setAnimals(await listAnimalPurchases(activeLocationId) || []);
    } catch (err) {
      setMessage(err.message || "Failed to load livestock");
    } finally {
      setLoading(false);
    }
  }, [activeLocationId]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = async (animal) => {
    if (expandedId === animal.id) { setExpandedId(null); return; }
    setExpandedId(animal.id);
    if (!details[animal.id]) {
      try {
        const detail = await getAnimalPurchase(animal.id);
        setDetails((prev) => ({ ...prev, [animal.id]: detail }));
      } catch (err) {
        setMessage(err.message || "Failed to load detail");
      }
    }
  };

  const submitPurchase = async (event) => {
    event.preventDefault();
    const cost = Number(buyForm.total_cost);
    if (!Number.isFinite(cost) || cost <= 0) { setMessage("Animal cost must be greater than zero"); return; }
    const extraLines = extras
      .filter((line) => line.description.trim() && Number(line.amount) > 0)
      .map((line) => ({ description: line.description.trim(), quantity: 1, unit: "item", unit_cost: Number(line.amount) }));
    setSaving(true);
    setMessage("");
    try {
      await createAnimalPurchase({
        location_id: Number(activeLocationId),
        animal_type: buyForm.animal_type,
        total_cost: cost,
        reference: buyForm.reference || undefined,
        supplier_name: buyForm.supplier_name || undefined,
        payment_method: buyForm.payment_method,
        expense_date: buyForm.expense_date || undefined,
        notes: buyForm.notes || undefined,
        extra_lines: extraLines,
      });
      setBuyForm({ animal_type: "cattle", reference: "", total_cost: "", supplier_name: "", payment_method: "cash", expense_date: "", notes: "" });
      setExtras([]);
      setShowBuy(false);
      setMessage("Animal purchase recorded.");
      await load();
    } catch (err) {
      setMessage(err.message || "Failed to record purchase");
    } finally {
      setSaving(false);
    }
  };

  const slaughterValue = (form, key) => Number(form[key] || 0);
  const slaughterPreview = (animal) => {
    const form = slaughterForm;
    const pieceOffset = PIECE_OUTPUTS.reduce((sum, [key]) => sum + slaughterValue(form, `${key}_count`) * slaughterValue(form, `${key}_price`), 0);
    const totalKg = KG_OUTPUTS.reduce((sum, [key]) => sum + slaughterValue(form, `${key}_kg`), 0);
    const remaining = Number(animal.total_cost) - pieceOffset;
    const effectiveKg = totalKg * (1 - slaughterValue(form, "shrinkage_pct") / 100);
    return { pieceOffset, totalKg, remaining, effectiveKg, costPerKg: effectiveKg > 0 ? remaining / effectiveKg : 0 };
  };

  const submitSlaughter = async (animal) => {
    const form = slaughterForm;
    const preview = slaughterPreview(animal);
    if (preview.totalKg <= 0 && preview.pieceOffset <= 0) { setMessage("Record at least one output"); return; }
    if (preview.remaining < 0) { setMessage("Estimated set/hide value exceeds the animal cost"); return; }
    setSaving(true);
    setMessage("");
    try {
      const payload = { shrinkage_pct: slaughterValue(form, "shrinkage_pct") };
      for (const [key] of KG_OUTPUTS) payload[`${key}_kg`] = slaughterValue(form, `${key}_kg`);
      for (const [key] of PIECE_OUTPUTS) {
        payload[`${key}_count`] = slaughterValue(form, `${key}_count`);
        payload[`${key}_price`] = slaughterValue(form, `${key}_price`);
      }
      await slaughterAnimal(animal.id, payload);
      setSlaughteringId(null);
      setSlaughterForm({});
      setMessage("Slaughter recorded — stock pools updated.");
      await load();
    } catch (err) {
      setMessage(err.message || "Failed to record slaughter");
    } finally {
      setSaving(false);
    }
  };

  const pending = animals.filter((a) => a.status === "pending");
  const done = animals.filter((a) => a.status !== "pending");
  const preview = slaughteringId ? slaughterPreview(animals.find((a) => a.id === slaughteringId) || { total_cost: 0 }) : null;

  if (loading) return <p className="text-textSecondary text-sm">Loading livestock…</p>;

  return (
    <div className="space-y-5">
      {message && <p className="text-sm text-warning">{message}</p>}

      {!showBuy ? (
        <button type="button" onClick={() => setShowBuy(true)} className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold">
          + Record animal purchase
        </button>
      ) : (
        <form onSubmit={submitPurchase} className="rounded-xl border border-borderColor bg-surface2 p-4 space-y-4">
          <h2 className="text-textPrimary font-bold">Buy a live animal</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-textSecondary">Animal type
              <select className={`${inputClass} mt-1`} value={buyForm.animal_type} onChange={(e) => setBuyForm({ ...buyForm, animal_type: e.target.value })} disabled={saving}>
                <option value="cattle">Cattle (beef)</option>
                <option value="goat">Goat</option>
              </select>
            </label>
            <label className="text-xs text-textSecondary">Reference (tag / receipt no.)
              <input className={`${inputClass} mt-1`} value={buyForm.reference} onChange={(e) => setBuyForm({ ...buyForm, reference: e.target.value })} maxLength={100} disabled={saving} />
            </label>
            <label className="text-xs text-textSecondary">Animal cost (KES)
              <input className={`${inputClass} mt-1`} type="number" min="0" step="0.01" value={buyForm.total_cost} onChange={(e) => setBuyForm({ ...buyForm, total_cost: e.target.value })} required disabled={saving} />
            </label>
            <label className="text-xs text-textSecondary">Supplier
              <input className={`${inputClass} mt-1`} value={buyForm.supplier_name} onChange={(e) => setBuyForm({ ...buyForm, supplier_name: e.target.value })} disabled={saving} />
            </label>
            <label className="text-xs text-textSecondary">Paid via
              <select className={`${inputClass} mt-1`} value={buyForm.payment_method} onChange={(e) => setBuyForm({ ...buyForm, payment_method: e.target.value })} disabled={saving}>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </label>
            <label className="text-xs text-textSecondary">Purchase date
              <input className={`${inputClass} mt-1`} type="date" value={buyForm.expense_date} onChange={(e) => setBuyForm({ ...buyForm, expense_date: e.target.value })} disabled={saving} />
            </label>
            <label className="text-xs text-textSecondary">Notes
              <input className={`${inputClass} mt-1`} value={buyForm.notes} onChange={(e) => setBuyForm({ ...buyForm, notes: e.target.value })} maxLength={500} disabled={saving} />
            </label>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-textSecondary">Extra costs (transport, slaughter fee, etc.) — added to the animal's cost</label>
            {extras.map((line, index) => (
              <div key={index} className="flex gap-2">
                <input className={`${inputClass} flex-1 min-w-0`} placeholder="Description" value={line.description} onChange={(e) => setExtras((prev) => prev.map((l, i) => (i === index ? { ...l, description: e.target.value } : l)))} disabled={saving} />
                <input className={`${inputClass} w-24 shrink-0`} type="number" min="0" step="0.01" placeholder="Amount" value={line.amount} onChange={(e) => setExtras((prev) => prev.map((l, i) => (i === index ? { ...l, amount: e.target.value } : l)))} disabled={saving} />
                <button type="button" onClick={() => setExtras((prev) => prev.filter((_, i) => i !== index))} disabled={saving} className="px-2 py-1 rounded-lg border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/10">×</button>
              </div>
            ))}
            <button type="button" onClick={() => setExtras((prev) => [...prev, { description: "", amount: "" }])} disabled={saving} className="px-2 py-1 rounded-lg border border-borderColor bg-surface1 text-textSecondary text-xs font-semibold hover:bg-surface3">
              + Add extra cost
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold disabled:opacity-50">
              {saving ? "Saving…" : "Record purchase"}
            </button>
            <button type="button" onClick={() => { setShowBuy(false); setMessage(""); }} disabled={saving} className="px-3 py-2 rounded-lg border border-borderColor text-textSecondary text-xs font-semibold hover:bg-surface3">Cancel</button>
          </div>
        </form>
      )}

      <div>
        <h3 className="text-textPrimary font-bold mb-2">Awaiting slaughter ({pending.length})</h3>
        <div className="rounded-xl border border-borderColor overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface2 text-textSecondary">
              <tr><th className="p-3 text-left">Bought</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Reference</th><th className="p-3 text-left">Supplier</th><th className="p-3 text-right">Cost</th><th className="p-3 text-right">Action</th></tr>
            </thead>
            <tbody>
              {pending.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-textMuted">No animals awaiting slaughter.</td></tr>
              ) : pending.map((animal) => (
                <Fragment key={animal.id}>
                  <tr className="border-t border-borderColor text-textPrimary">
                    <td className="p-3 whitespace-nowrap">{new Date(animal.expense_date || animal.created_at).toLocaleDateString("en-KE")}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">{animal.animal_type === "goat" ? "Goat" : "Cattle"}</span></td>
                    <td className="p-3">{animal.reference || `#${animal.id}`}</td>
                    <td className="p-3">{animal.supplier_name || "—"}</td>
                    <td className="p-3 text-right">KES {Number(animal.total_cost).toLocaleString("en-KE")}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => { setSlaughteringId(slaughteringId === animal.id ? null : animal.id); setSlaughterForm({}); }}
                        className="px-3 py-1 rounded-lg bg-primary text-onPrimary text-xs font-semibold">
                        {slaughteringId === animal.id ? "Close" : "Record slaughter"}
                      </button>
                    </td>
                  </tr>
                  {slaughteringId === animal.id && (
                    <tr className="border-t border-borderColor">
                      <td colSpan={6} className="p-0">
                        <div className="p-3 sm:p-4 bg-surface1 space-y-4">
                          <p className="text-textSecondary text-xs">
                            Enter the outputs. Head/legs sets and hides carry cost equal to their expected sale price; the rest of the KES {Number(animal.total_cost).toLocaleString("en-KE")} cost spreads over the kg outputs.
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {KG_OUTPUTS.map(([key, label]) => (
                              <label key={key} className="text-xs text-textSecondary">
                                {key === "meat" ? (animal.animal_type === "goat" ? "Goat meat" : "Beef — meat & bones") : label} (kg)
                                <input className={`${inputClass} mt-1`} type="number" min="0" step="0.001" value={slaughterForm[`${key}_kg`] ?? ""} placeholder="0" onChange={(e) => setSlaughterForm((prev) => ({ ...prev, [`${key}_kg`]: e.target.value }))} disabled={saving} />
                              </label>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {PIECE_OUTPUTS.map(([key, label]) => (
                              <Fragment key={key}>
                                <label className="text-xs text-textSecondary">{label} (count)
                                  <input className={`${inputClass} mt-1`} type="number" min="0" step="1" value={slaughterForm[`${key}_count`] ?? ""} placeholder="0" onChange={(e) => setSlaughterForm((prev) => ({ ...prev, [`${key}_count`]: e.target.value }))} disabled={saving} />
                                </label>
                                <label className="text-xs text-textSecondary">{label} est. price each
                                  <input className={`${inputClass} mt-1`} type="number" min="0" step="0.01" value={slaughterForm[`${key}_price`] ?? ""} placeholder="0" onChange={(e) => setSlaughterForm((prev) => ({ ...prev, [`${key}_price`]: e.target.value }))} disabled={saving} />
                                </label>
                              </Fragment>
                            ))}
                            <label className="text-xs text-textSecondary">Expected drying loss (%)
                              <input className={`${inputClass} mt-1`} type="number" min="0" max="99" step="0.1" value={slaughterForm.shrinkage_pct ?? ""} placeholder="0" onChange={(e) => setSlaughterForm((prev) => ({ ...prev, shrinkage_pct: e.target.value }))} disabled={saving} />
                            </label>
                          </div>
                          {preview && (preview.totalKg > 0 || preview.pieceOffset > 0) && (
                            <p className="text-textSecondary text-xs">
                              {preview.totalKg}kg entered → {preview.effectiveKg.toFixed(1)}kg after shrinkage ·
                              set/hide offset KES {preview.pieceOffset.toLocaleString("en-KE")} ·
                              cost per kg ≈ <span className="font-semibold text-textPrimary">KES {preview.costPerKg.toFixed(2)}</span>
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => submitSlaughter(animal)}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold disabled:opacity-50">
                            {saving ? "Recording…" : "Confirm slaughter"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-textPrimary font-bold mb-2">Slaughtered / cancelled</h3>
        <div className="rounded-xl border border-borderColor overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface2 text-textSecondary">
              <tr><th className="p-3 text-left">Bought</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Reference</th><th className="p-3 text-right">Cost</th><th className="p-3 text-left">Status</th></tr>
            </thead>
            <tbody>
              {done.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-center text-textMuted">No slaughtered or cancelled animals yet.</td></tr>
              ) : done.map((animal) => (
                <Fragment key={animal.id}>
                  <tr className="border-t border-borderColor text-textPrimary cursor-pointer hover:bg-surface1" onClick={() => toggleExpand(animal)}>
                    <td className="p-3 whitespace-nowrap">{new Date(animal.expense_date || animal.created_at).toLocaleDateString("en-KE")}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">{animal.animal_type === "goat" ? "Goat" : "Cattle"}</span></td>
                    <td className="p-3">{animal.reference || `#${animal.id}`}</td>
                    <td className="p-3 text-right">KES {Number(animal.total_cost).toLocaleString("en-KE")}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${animal.status === "slaughtered" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                        {animal.status}
                      </span>
                    </td>
                  </tr>
                  {expandedId === animal.id && details[animal.id]?.outputs?.length > 0 && (
                    <tr className="border-t border-borderColor">
                      <td colSpan={5} className="p-3 bg-surface1">
                        <p className="text-textMuted text-xs font-semibold mb-1">
                          Outputs{details[animal.id].shrinkage_pct > 0 ? ` (${details[animal.id].shrinkage_pct}% shrinkage applied)` : ""}
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {details[animal.id].outputs.map((output) => (
                            <span key={output.id} className="text-xs text-textSecondary">
                              {output.pool_key}: <span className="text-textPrimary font-semibold">{Number(output.quantity)}</span> @ KES {Number(output.unit_cost).toFixed(2)}
                              {output.est_value != null && <span className="text-textMuted"> · est. {Number(output.est_value).toLocaleString("en-KE")}</span>}
                              {output.sold_qty > 0 && <span className="text-success"> · sold {Number(output.sold_qty)} → KES {Number(output.sold_revenue).toLocaleString("en-KE")}</span>}
                            </span>
                          ))}
                        </div>
                        {details[animal.id].est_yield_value != null && (
                          <p className="text-xs text-textSecondary mt-2">
                            Cost KES {Number(animal.total_cost).toLocaleString("en-KE")} → est. yield value{" "}
                            <span className="text-textPrimary font-semibold">KES {Number(details[animal.id].est_yield_value).toLocaleString("en-KE")}</span>
                            {" "}· est. margin{" "}
                            <span className={`font-semibold ${details[animal.id].est_margin >= 0 ? "text-success" : "text-danger"}`}>
                              KES {Number(details[animal.id].est_margin).toLocaleString("en-KE")}
                            </span>
                          </p>
                        )}
                        {details[animal.id].actual_revenue > 0 && (
                          <p className="text-xs text-textSecondary mt-1">
                            Sold so far (FIFO): revenue{" "}
                            <span className="text-textPrimary font-semibold">KES {Number(details[animal.id].actual_revenue).toLocaleString("en-KE")}</span>
                            {" "}· cost of what sold KES {Number(details[animal.id].actual_cogs).toLocaleString("en-KE")}
                            {" "}· margin{" "}
                            <span className={`font-semibold ${details[animal.id].actual_margin >= 0 ? "text-success" : "text-danger"}`}>
                              KES {Number(details[animal.id].actual_margin).toLocaleString("en-KE")}
                            </span>
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function CatalogStockAdmin({ staffRole, initialTab }) {
  const { activeLocationId, locations } = useActiveLocation();
  const activeLocation = locations.find((location) => String(location.id) === String(activeLocationId));
  const canTransfer = (staffRole === "admin" || staffRole === "supervisor") && Boolean(activeLocation?.is_stock_store);
  // Livestock is admin-only and only at shops running butchery (empty
  // business_types = unrestricted shop runs everything).
  const runsButchery =
    !activeLocation?.business_types?.length ||
    activeLocation.business_types.includes("butchery");
  const canLivestock = staffRole === "admin" && runsButchery;
  const allowedTabs = ["catalog", "gas", canLivestock && "livestock", (staffRole === "admin" || staffRole === "supervisor") && "refill-requests", canTransfer && "transfers"].filter(Boolean);
  const [activeTab, setActiveTab] = useState(
    allowedTabs.includes(initialTab) ? initialTab : "catalog",
  );
  // Tab panes stay mounted once visited, so their data goes stale — bump a
  // visit counter on every switch to remount the target pane and refetch.
  const [tabVisit, setTabVisit] = useState(0);
  const handleTabChange = (key) => {
    setActiveTab(key);
    setTabVisit((v) => v + 1);
  };
  // Deep links (e.g. the nav refill-requests badge) can retarget the tab.
  useEffect(() => {
    if (initialTab && allowedTabs.includes(initialTab)) setActiveTab(initialTab);
  }, [initialTab]);

  // Pending refill count for the tab header — requests waiting on THIS shop
  // to fulfill (store side), same directional rule as the nav badge.
  const canSeeRefills = staffRole === "admin" || staffRole === "supervisor";
  const [refillWaiting, setRefillWaiting] = useState(0);
  useEffect(() => {
    if (!canSeeRefills) return;
    let cancelled = false;
    const load = async () => {
      if (!navigator.onLine) return;
      try {
        const rows = await listRefillRequests(activeLocationId || undefined);
        if (!cancelled) {
          setRefillWaiting((rows || []).filter((r) =>
            (r.status === "pending" || r.status === "in_progress") &&
            (!activeLocationId || Number(r.stock_store_location_id) === Number(activeLocationId)),
          ).length);
        }
      } catch {
        if (!cancelled) setRefillWaiting(0);
      }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [canSeeRefills, activeLocationId]);

  return (
    <main className="p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-textPrimary">
          Catalog &amp; Stock
        </h1>
        <p className="text-textSecondary text-sm mt-1">
          Manage products and gas cylinder inventory in one place.
        </p>
      </div>

      <CTabs activeItemKey={activeTab} onChange={handleTabChange} className="catalog-stock-tabs">
        <CTabList variant="tabs">
          <CTab itemKey="catalog">Catalog</CTab>
          <CTab itemKey="gas">Gas Stock</CTab>
          {canLivestock && <CTab itemKey="livestock">Livestock</CTab>}
          {(staffRole === "admin" || staffRole === "supervisor") && (
            <CTab itemKey="refill-requests">
              Refill Requests
              {refillWaiting > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold align-middle">
                  {refillWaiting}
                </span>
              )}
            </CTab>
          )}
          {canTransfer && <CTab itemKey="transfers">Transfers</CTab>}
        </CTabList>
        <CTabContent>
          <CTabPanel className="p-3" itemKey="catalog">
            {activeTab === "catalog" && <CatalogTab key={`catalog-${tabVisit}`} staffRole={staffRole} />}
          </CTabPanel>
          <CTabPanel className="p-3" itemKey="gas">
            {activeTab === "gas" && <GasStockTab key={`gas-${tabVisit}`} staffRole={staffRole} />}
          </CTabPanel>

          {canLivestock && (
            <CTabPanel className="p-3" itemKey="livestock">
              {activeTab === "livestock" && <LivestockTab key={`livestock-${tabVisit}`} />}
            </CTabPanel>
          )}
          {(staffRole === "admin" || staffRole === "supervisor") && (
            <CTabPanel className="p-3" itemKey="refill-requests">
              {activeTab === "refill-requests" && <RefillRequestsTab key={`refill-${tabVisit}`} staffRole={staffRole} />}
            </CTabPanel>
          )}
          {canTransfer && (
            <CTabPanel className="p-3" itemKey="transfers">
              {activeTab === "transfers" && <StockTransfersTab key={`transfers-${tabVisit}`} staffRole={staffRole} />}
            </CTabPanel>
          )}
        </CTabContent>
      </CTabs>
    </main>
  );
}
