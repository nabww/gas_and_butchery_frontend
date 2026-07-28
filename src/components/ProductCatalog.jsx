import { useState, useEffect, useMemo, useCallback } from "react";
import {
  loadProducts as loadCachedProducts,
  refreshProductCache,
  refreshCylinderBrandCache,
  loadCylinderBrands,
} from "../lib/cache/catalogCache";
import GasProductCard from "./GasProductCard";
import RetailProductCard from "./RetailProductCard";
import CategoryPills from "./CategoryPills";

const DEFAULT_BUSINESSES = ["butchery", "gas"];

export default function ProductCatalog({
  businessType = "butchery",
  allowedBusinesses = DEFAULT_BUSINESSES,
  onSelectBusiness,
  staffRole,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [allBrands, setAllBrands] = useState([]);

  useEffect(() => {
    loadProducts();
  }, [businessType]);

  const handleRefresh = async () => {
    if (!navigator.onLine) {
      setError("Cannot refresh while offline");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (businessType === "gas") {
        await Promise.all([
          refreshCylinderBrandCache(),
          refreshProductCache("accessory"),
        ]);
      } else {
        await refreshProductCache(businessType);
      }
      await loadProducts();
    } catch (err) {
      console.error("Failed to refresh catalog", err);
      setError(err.message || "Failed to refresh catalog");
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      if (businessType === "gas") {
        const [brands, accessories] = await Promise.all([
          loadCylinderBrands(),
          loadCachedProducts("accessory"),
        ]);
        setAllBrands(brands);
        const gasItems = brands.map((b) => ({
          id: `brand-${b.id}`,
          brand_id: b.id,
          brand: b.brand,
          weight_kg: b.weight_kg,
          name: `${b.brand} ${b.weight_kg}kg`,
          refill_price: b.refill_price,
          cylinder_value: b.cylinder_value,
          pricing_type: "fixed",
          is_brand: true,
          filled_qty: b.filled_qty,
          empty_qty: b.empty_qty,
        }));
        setProducts([...gasItems, ...accessories]);
      } else {
        const data = await loadCachedProducts(businessType);
        console.log("Catalog load:", { businessType, data });
        const filtered = Array.isArray(data)
          ? data.filter((p) => p.business_type === businessType)
          : [];
        setProducts(filtered);
      }
    } catch (err) {
      console.error("Failed to load products", err);
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      (p.name || "").toLowerCase().includes(term),
    );
  }, [products, search]);

  const cylinderBrands = useMemo(() => {
    return filteredProducts
      .filter((p) => p.is_brand)
      .reduce((groups, product) => {
        const group = groups.get(product.brand) || [];
        group.push(product);
        return groups.set(product.brand, group);
      }, new Map());
  }, [filteredProducts]);

  const accessories = useMemo(
    () => filteredProducts.filter((p) => !p.is_brand),
    [filteredProducts],
  );

  return (
    <div className="flex flex-col h-full bg-surface1">
      {/* Search and category navigation */}
      <div className="sticky top-0 z-10 bg-surface1/95 backdrop-blur border-b border-borderColor p-5 space-y-4">
        {allowedBusinesses.length > 1 && (
          <CategoryPills
            categories={allowedBusinesses}
            active={businessType}
            onSelect={onSelectBusiness}
          />
        )}

        <div className="relative flex gap-2">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted text-lg">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${businessType} products...`}
            className="flex-1 pl-11 pr-4 py-3 rounded-xl bg-surface2 border border-borderColor text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-3 rounded-xl bg-surface2 border border-borderColor text-textSecondary hover:bg-surface3 hover:text-textPrimary disabled:opacity-50 transition-colors"
            title="Refresh products">
            ↻
          </button>
        </div>
      </div>

      {/* Alerts */}
      {toast && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-sm font-semibold" role="alert">
          {toast}
        </div>
      )}
      {error && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-sm font-semibold">
          {error}
        </div>
      )}

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-textSecondary">
            Loading products...
          </div>
        ) : businessType === "gas" ? (
          <div className="space-y-8">
            {[...cylinderBrands.entries()].map(([brand, brandItems]) => (
              <section key={brand}>
                <h2 className="text-textPrimary text-xl font-bold mb-4 flex items-center gap-2">
                  <span>🔥</span>
                  <span>{brand}</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                  {brandItems.map((product) => (
                    <GasProductCard
                      key={product.id}
                      product={product}
                      onToast={showToast}
                      staffRole={staffRole}
                      allBrands={allBrands}
                    />
                  ))}
                </div>
              </section>
            ))}

            {accessories.length > 0 && (
              <section>
                <h2 className="text-textPrimary text-xl font-bold mb-4">Accessories</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                  {accessories.map((product) => (
                    <RetailProductCard
                      key={product.id}
                      product={product}
                      onToast={showToast}
                    />
                  ))}
                </div>
              </section>
            )}

            {cylinderBrands.size === 0 && accessories.length === 0 && (
              <div className="text-center text-textSecondary py-16">
                No products match your search.
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {filteredProducts.map((product) => (
              <RetailProductCard
                key={product.id}
                product={product}
                onToast={showToast}
              />
            ))}
            {!loading && filteredProducts.length === 0 && (
              <div className="col-span-full text-center text-textSecondary py-16">
                No products match your search.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
