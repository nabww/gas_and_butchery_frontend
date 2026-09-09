import { useEffect, useMemo, useState, useCallback } from "react";
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
  adjustCylinderStock,
  updateStockThreshold,
  getOversellFlags,
  resolveOversellFlag,
  listLocations,
  listStockTransfers,
  createStockTransfer,
} from "../lib/api";
import CylinderBrandForm from "../components/CylinderBrandForm";
import GasRestockForm from "../components/GasRestockForm";
import ProductRestockForm from "../components/ProductRestockForm";
import { useActiveLocation } from "../contexts/LocationContext";

const businessOptions = ["butchery", "accessory"];
const inputClass =
  "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

    try {
      const payload = {
        name: name.trim(),
        business_type: businessType,
        pricing_type: pricingType,
        unit_price: parsedPrice,
        track_stock: trackStock,
        low_stock_threshold: trackStock ? Number(lowStockThreshold || 0) : 0,
        qty_on_hand: trackStock ? Number(qtyOnHand || 0) : 0,
        is_active: isActive,
      };

      if (editing) {
        await updateProduct(editing.id, payload, activeLocationId);
      } else {
        await createProduct(payload, activeLocationId);
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

        {trackStock && (
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
          {product.track_stock ? (
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
          {product.track_stock && (
            <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] font-semibold uppercase tracking-wide">
              Stock tracked
            </span>
          )}
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
        }, activeLocationId);
      }
      if (thresholdChanged) {
        await updateStockThreshold(item.cylinder_brand_id, parseInt(threshold), activeLocationId);
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

  const handleFieldKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!saving) handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
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
          {editing ? (
            <input
              type="number"
              min="0"
              value={filledQty}
              onChange={(e) => setFilledQty(e.target.value)}
              onKeyDown={handleFieldKeyDown}
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
              onKeyDown={handleFieldKeyDown}
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
              onKeyDown={handleFieldKeyDown}
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
                  className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex justify-end gap-2 flex-wrap">
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

function CatalogTab() {
  const { activeLocationId } = useActiveLocation();
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await getProducts(null, true, activeLocationId);
      setProducts(rows);
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
      setOversells(oversellData);
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

  return (
    <div className="space-y-4">
      {toast && (
        <div className="p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
          {toast}
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

export default function CatalogStockAdmin({ staffRole }) {
  const { activeLocationId, locations } = useActiveLocation();
  const activeLocation = locations.find((location) => String(location.id) === String(activeLocationId));
  const canTransfer = (staffRole === "admin" || staffRole === "supervisor") && Boolean(activeLocation?.is_stock_store);

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

      <CTabs defaultActiveItemKey="catalog" className="catalog-stock-tabs">
        <CTabList variant="tabs">
          <CTab itemKey="catalog">Catalog</CTab>
          <CTab itemKey="gas">Gas Stock</CTab>
          {staffRole === "admin" && <CTab itemKey="restock">Restock</CTab>}
          {canTransfer && <CTab itemKey="transfers">Transfers</CTab>}
        </CTabList>
        <CTabContent>
          <CTabPanel className="p-3" itemKey="catalog">
            <CatalogTab />
          </CTabPanel>
          <CTabPanel className="p-3" itemKey="gas">
            <GasStockTab staffRole={staffRole} />
          </CTabPanel>
          {staffRole === "admin" && (
            <CTabPanel className="p-3" itemKey="restock">
              <RestockTab />
            </CTabPanel>
          )}
          {canTransfer && (
            <CTabPanel className="p-3" itemKey="transfers">
              <StockTransfersTab staffRole={staffRole} />
            </CTabPanel>
          )}
        </CTabContent>
      </CTabs>
    </main>
  );
}
