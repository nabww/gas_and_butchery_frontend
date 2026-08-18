import { useState, useEffect, useMemo, useRef } from "react";
import {
  loadCurrentSale,
  resetCurrentSale,
  getPendingSaleSnapshot,
} from "../lib/db/syncQueue";
import { getStoredStaff, checkBackendReachable } from "../lib/api";
import { useCart } from "../contexts/CartContext";
import { useActiveLocation } from "../contexts/LocationContext";
import { setOfflineSalesEnabled } from "../lib/settings";
import ProductCatalog from "../components/ProductCatalog";
import CategoryPills from "../components/CategoryPills";
import Cart from "../components/Cart";
import CustomerSelector from "../components/CustomerSelector";
import Payment from "../components/Payment";
import "../styles/till.css";
import { CTabs, CTabList, CTab } from "@coreui/react";
import "@coreui/coreui/dist/css/coreui.min.css";

function useBackendOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let polling = false;
    const runCheck = async () => {
      if (polling) return;
      polling = true;
      const ok = await checkBackendReachable();
      if (!cancelled) {
        setIsOnline(ok);
      }
      polling = false;
    };
    runCheck();
    const id = setInterval(runCheck, 5000);
    const onNetChange = () => runCheck();
    window.addEventListener("online", onNetChange);
    window.addEventListener("offline", onNetChange);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("online", onNetChange);
      window.removeEventListener("offline", onNetChange);
    };
  }, []);
  return isOnline;
}

const DEFAULT_BUSINESSES = ["butchery", "gas"];

export default function Till({ staff, onNavigate }) {
  const isOnline = useBackendOnlineStatus();
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const prevOnlineRef = useRef(true);

  useEffect(() => {
    if (prevOnlineRef.current && !isOnline) {
      setOfflineSalesEnabled(true);
      setShowOfflineModal(true);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  const { activeLocationId, locations } = useActiveLocation();
  // A supervisor/admin who has switched shops via the nav sees that shop's
  // catalog and stock here too — useful for admins checking stock or
  // covering a rush at another branch. Cashiers (and anyone without switch
  // rights) always see their own login location; undefined here means
  // "use my own location" server-side.
  const canSwitchLocation =
    staff?.role === "admin" || (staff?.role === "supervisor" && staff?.canSwitchLocation);
  const catalogLocationId = canSwitchLocation ? activeLocationId : undefined;
  // Selling *as* another shop (the sale itself gets that shop's location_id)
  // is admin-only -- the sync endpoint only lets an admin token upload a
  // snapshot for a location other than their own (see sync.routes.js). A
  // supervisor with can_switch_location can browse another shop's stock
  // here but still rings up sales under their own home location.
  const saleLocationOverride =
    staff?.role === "admin" ? activeLocationId : undefined;
  // Silent misattribution risk: an admin's sales are tagged with whichever
  // shop the switcher is set to, which can be leftover from browsing a
  // different branch earlier. Surface it loudly so a sale never lands on
  // the wrong branch's books without the admin noticing.
  const isSellingElsewhere =
    !!saleLocationOverride &&
    String(saleLocationOverride) !== String(staff?.locationId);
  const sellingLocationName = isSellingElsewhere
    ? locations.find((l) => String(l.id) === String(saleLocationOverride))?.name
    : null;
  const homeLocationName = isSellingElsewhere
    ? locations.find((l) => String(l.id) === String(staff?.locationId))?.name
    : null;
  // The shop actually being sold at/for -- same location the sale itself
  // will be booked to (see saleLocationOverride above). A shop with no
  // configured business_types is unrestricted (runs everything).
  const effectiveLocationId = saleLocationOverride || staff?.locationId;
  const effectiveLocation = useMemo(
    () => locations.find((l) => String(l.id) === String(effectiveLocationId)),
    [locations, effectiveLocationId],
  );
  const shopBusinessTypes = effectiveLocation?.business_types || [];
  // Lets a shop rename "butchery" to whatever it actually sells (e.g.
  // "Bakery") without touching the underlying business_type value used
  // everywhere else (products, stock, staff access).
  const businessLabels = effectiveLocation?.business_type_labels || {};

  const allowedBusinesses = useMemo(() => {
    const access = staff?.businessAccess || [];
    let ordered = DEFAULT_BUSINESSES.filter((b) => access.includes(b));
    if (ordered.length === 0) ordered = DEFAULT_BUSINESSES;
    if (shopBusinessTypes.length > 0) {
      ordered = ordered.filter((b) => shopBusinessTypes.includes(b));
    }
    return ordered;
  }, [staff?.businessAccess, shopBusinessTypes]);

  const [businessType, setBusinessType] = useState(allowedBusinesses[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);
  const [pendingConsentCustomer, setPendingConsentCustomer] = useState(null);
  const isInitializing = useRef(false);
  // On narrow screens the catalog and cart can't both fit on screen at
  // once without squashing the cart into an unusable sliver -- show one
  // full-height pane at a time instead (desktop/tablet still shows both
  // side by side; see till.css). Both panes stay mounted so switching
  // tabs never resets scroll position or in-progress input.
  const [mobileTab, setMobileTab] = useState("catalog");
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
      const sale = await loadCurrentSale(currentStaff, saleLocationOverride);
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
      await resetCurrentSale(currentStaff, saleLocationOverride);
    } catch (err) {
      setError(err.message);
    }
    resetCart();
    setMobileTab("catalog");
    await initializeNewSale();
  };

  const handleRegisterPendingCustomer = () => {
    if (!pendingConsentCustomer) return;
    sessionStorage.setItem("tezipos-prefill-customer-phone", pendingConsentCustomer.phone);
    setPendingConsentCustomer(null);
    onNavigate?.("/customers");
  };

  return (
    <div className="till-container">
      <div className="till-header">
        <h1>Sales Till</h1>
        {allowedBusinesses.length > 1 && (
          <div className="till-header-pills">
            <CategoryPills
              categories={allowedBusinesses}
              active={businessType}
              onSelect={setBusinessType}
              labels={businessLabels}
            />
          </div>
        )}
        <div className="flex items-center gap-4 text-textSecondary text-sm">
          <span
            className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-success" : "bg-warning"}`}
            aria-label={isOnline ? "System online" : "Working offline"}
            title={isOnline ? "System online" : "Working offline"}></span>
        </div>
      </div>

      {showOfflineModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-surface2 p-6 rounded-2xl border border-borderColor max-w-sm w-full text-center m-4">
            <h2 className="text-lg font-bold text-textPrimary">Working offline</h2>
            <p className="text-sm text-textSecondary mt-2">
              The connection to the server was lost. You can keep making sales — they will
              sync automatically once the connection is restored.
            </p>
            <button
              type="button"
              onClick={() => setShowOfflineModal(false)}
              className="mt-4 px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm">
              Continue
            </button>
          </div>
        </div>
      )}

      {isSellingElsewhere && (
        <div className="selling-elsewhere-banner">
          ⚠ Selling as {sellingLocationName || `location ${saleLocationOverride}`}. Sales made now will be booked
          to that branch, not yours.
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {allowedBusinesses.length === 0 && (
        <div className="error-banner">
          This shop doesn't run any of the businesses you have access to
          ({(staff?.businessAccess || []).join(", ") || "none"}). Ask an admin to update
          your access or this shop's configured businesses.
        </div>
      )}

      {loading && <div className="loading">Initializing sale...</div>}

      {!loading && allowedBusinesses.length > 0 && (
        <>
          {/* Mobile-only tab switcher -- hidden on tablet/desktop, where
              both panes already show side by side (see till.css). */}
          <CTabs
            activeItemKey={mobileTab}
            onChange={setMobileTab}
            className="till-mobile-tabs catalog-stock-tabs">
            <CTabList variant="tabs">
              <CTab itemKey="catalog">Catalog</CTab>
              <CTab itemKey="cart">Cart{items.length > 0 ? ` (${items.length})` : ""}</CTab>
            </CTabList>
          </CTabs>

          <div className={`till-content mobile-view-${mobileTab}`}>
            {/* Left pane: Product catalog */}
            <div className="left-pane">
              <ProductCatalog
                businessType={businessType}
                allowedBusinesses={allowedBusinesses}
                onSelectBusiness={setBusinessType}
                staffRole={staff?.role}
                refreshSignal={catalogRefreshKey}
                locationId={catalogLocationId}
                businessLabels={businessLabels}
                hideCategoryPills
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
                    <Payment
                      isOnline={isOnline}
                      onSaleCompleted={() => setCatalogRefreshKey((k) => k + 1)}
                      onNewMpesaCustomer={setPendingConsentCustomer}
                    />
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
        </>
      )}

      {pendingConsentCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface2 border border-borderColor rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-bold text-textPrimary">New M-Pesa customer</h2>
            <p className="text-textSecondary text-sm">
              <span className="font-semibold">{pendingConsentCustomer.phone}</span> paid via
              M-Pesa but isn't registered — no consent is on file to retain their details, so
              this record will be auto-purged in 3 months unless registered.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRegisterPendingCustomer}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-onPrimary font-semibold text-sm hover:bg-primaryDark transition-colors">
                Register now
              </button>
              <button
                onClick={() => setPendingConsentCustomer(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-borderColor bg-surface1 text-textSecondary font-semibold text-sm hover:bg-surface3 hover:text-textPrimary transition-colors">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
