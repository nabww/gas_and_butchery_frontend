import { useState, useEffect, useMemo, useRef } from "react";
import {
  loadCurrentSale,
  resetCurrentSale,
  getPendingSaleSnapshot,
} from "../lib/db/syncQueue";
import { getStoredStaff } from "../lib/api";
import { useCart } from "../contexts/CartContext";
import {
  isOfflineSalesEnabled,
  setOfflineSalesEnabled,
} from "../lib/settings";
import ProductCatalog from "../components/ProductCatalog";
import Cart from "../components/Cart";
import CustomerSelector from "../components/CustomerSelector";
import Payment from "../components/Payment";
import "../styles/till.css";

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handler = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
    };
  }, []);
  return isOnline;
}

const DEFAULT_BUSINESSES = ["butchery", "gas"];

export default function Till({ staff }) {
  const isOnline = useOnlineStatus();
  const allowedBusinesses = useMemo(() => {
    const access = staff?.businessAccess || [];
    const ordered = DEFAULT_BUSINESSES.filter((b) => access.includes(b));
    return ordered.length > 0 ? ordered : DEFAULT_BUSINESSES;
  }, [staff?.businessAccess]);

  const [businessType, setBusinessType] = useState(allowedBusinesses[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offlineSalesEnabled, setOfflineSalesEnabledState] = useState(
    isOfflineSalesEnabled,
  );
  const isInitializing = useRef(false);
  const {
    saleId,
    setSaleId,
    setSaleLocalId,
    setItems,
    setDiscountAmount,
    items,
    resetCart,
  } = useCart();

  // Keep the active catalog inside the allowed set if permissions change.
  useEffect(() => {
    if (!allowedBusinesses.includes(businessType)) {
      setBusinessType(allowedBusinesses[0]);
    }
  }, [allowedBusinesses, businessType]);

  useEffect(() => {
    // Create a new sale when the till loads or the current sale is cleared.
    if (!saleId && !isInitializing.current) {
      initializeNewSale();
    }
  }, [saleId]);

  const initializeNewSale = async () => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    setLoading(true);
    setError("");
    try {
      const currentStaff = staff || getStoredStaff();
      const sale = await loadCurrentSale(currentStaff);
      setSaleId(sale.server_id || sale.local_id);
      setSaleLocalId(sale.local_id);
      setDiscountAmount(sale.discount_amount || 0);
      const snapshot = await getPendingSaleSnapshot(sale.local_id);
      if (snapshot && snapshot.items) {
        setItems(
          snapshot.items.map((i) => ({
            id: i.local_id,
            local_id: i.local_id,
            product_id: i.product_id,
            cylinder_brand_id: i.cylinder_brand_id,
            product_name: i.product_name || "Item",
            quantity: i.quantity,
            unit_price: i.unit_price,
            line_total: i.line_total,
            pricing_type: i.pricing_type,
            is_brand: i.cylinder_brand_id ? true : false,
          })),
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      isInitializing.current = false;
      setLoading(false);
    }
  };

  const handleStartNewSale = async () => {
    const currentStaff = staff || getStoredStaff();
    try {
      await resetCurrentSale(currentStaff);
    } catch (err) {
      setError(err.message);
    }
    resetCart();
    await initializeNewSale();
  };

  const handleToggleOfflineSales = () => {
    const next = !offlineSalesEnabled;
    setOfflineSalesEnabledState(next);
    setOfflineSalesEnabled(next);
  };

  return (
    <div className="till-container">
      <div className="till-header">
        <h1>Sales Till</h1>
        <div className="flex items-center gap-4 text-textSecondary text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={offlineSalesEnabled}
              onChange={handleToggleOfflineSales}
              className="w-4 h-4 accent-primary"
            />
            <span className="hidden sm:inline">Offline sales</span>
          </label>
          <span className="hidden sm:inline">TeziPOS</span>
          <span
            className={`w-2 h-2 rounded-full ${isOnline ? "bg-success" : "bg-warning"}`}
            aria-label={isOnline ? "System online" : "Working offline"}
            title={isOnline ? "System online" : "Working offline"}></span>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && <div className="loading">Initializing sale...</div>}

      {!loading && (
        <div className="till-content">
          {/* Left pane: Product catalog */}
          <div className="left-pane">
            <ProductCatalog
              businessType={businessType}
              allowedBusinesses={allowedBusinesses}
              onSelectBusiness={setBusinessType}
              staffRole={staff?.role}
            />
          </div>

          {/* Right pane: Cart, customer, payment */}
          <div className="right-pane">
            <div className="right-section customer-section">
              <CustomerSelector />
            </div>

            <div className="right-section cart-section">
              <Cart canRedeemPoints={staff?.canRedeemPoints} />
            </div>

            {items.length > 0 && (
              <>
                <div className="right-section checkout-section">
                  <Payment />
                </div>

                <div className="till-actions">
                  <button onClick={handleStartNewSale} className="btn-new-sale">
                    New Sale
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
