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
} from "../lib/api";
import CylinderBrandForm from "../components/CylinderBrandForm";

const businessOptions = ["butchery", "accessory"];
const inputClass =
  "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";

function ProductForm({ editing, onSaved, onCancel }) {
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
        await updateProduct(editing.id, payload);
      } else {
        await createProduct(payload);
      }

      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-surface2 border border-borderColor p-4 space-y-4">
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
            <option value="fixed">Fixed</option>
            <option value="weighted">Weighted</option>
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
          type="button"
          onClick={submit}
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
    </div>
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
                  className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary">
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

function CatalogTab() {
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
      const rows = await getProducts(null, true);
      setProducts(rows);
    } catch (err) {
      setError(err.message || "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

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

      <div className="rounded-2xl bg-surface2 border border-borderColor overflow-hidden">
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

export default function CatalogStockAdmin({ staffRole }) {
  return (
    <main className="p-6 max-w-6xl mx-auto">
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
        </CTabList>
        <CTabContent>
          <CTabPanel className="p-3" itemKey="catalog">
            <CatalogTab />
          </CTabPanel>
          <CTabPanel className="p-3" itemKey="gas">
            <GasStockTab staffRole={staffRole} />
          </CTabPanel>
        </CTabContent>
      </CTabs>
    </main>
  );
}
