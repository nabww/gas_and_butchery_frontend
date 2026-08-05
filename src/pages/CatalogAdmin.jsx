import { useEffect, useMemo, useState } from "react";
import { getProducts, createProduct, updateProduct } from "../lib/api";

const businessOptions = ["butchery", "gas", "accessory"];
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
  const [isActive, setIsActive] = useState(defaults.is_active !== false);
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
      setIsActive(editing.is_active !== false);
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
            className="text-xs text-textMuted hover:text-textPrimary">
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

export default function CatalogAdmin({ staffRole }) {
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
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
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-textPrimary">Catalog</h1>
          <p className="text-textSecondary text-sm mt-1">
            Product master, stock tracking, and shop-ready pricing controls.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 text-danger px-3 py-2 text-xs font-medium">
          {error}
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={openCreate}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm">
          + Add product
        </button>
      )}

      {showForm && (
        <>
          <ProductForm
            editing={editing}
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

      <div className="mt-6 rounded-2xl bg-surface2 border border-borderColor p-4">
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
          <div className="space-y-2">
            {filteredProducts.length === 0 ? (
              <p className="text-textMuted text-xs">
                No products match the current filters.
              </p>
            ) : (
              filteredProducts.map((product) => (
                <div key={product.id}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border border-borderColor bg-surface1 p-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-textPrimary font-semibold text-sm">
                          {product.name}
                        </p>
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">
                          {product.business_type}
                        </span>
                        {!product.is_active && (
                          <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger text-[10px] font-semibold uppercase tracking-wide">
                            Inactive
                          </span>
                        )}
                        {product.track_stock && (
                          <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] font-semibold uppercase tracking-wide">
                            Stock tracked
                          </span>
                        )}
                      </div>
                      <p className="text-textMuted text-xs mt-1">
                        Price {Number(product.unit_price || 0).toFixed(2)}
                        {product.track_stock
                          ? ` · Stock ${Number(product.qty_on_hand || 0)} · Threshold ${Number(product.low_stock_threshold || 0)}`
                          : " · No stock tracking"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(product)}
                        className="px-3 py-1.5 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3">
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
