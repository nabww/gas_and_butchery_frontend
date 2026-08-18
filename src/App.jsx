import { useEffect, useState } from "react";
import SignIn from "./pages/SignIn";
import RoleNav from "./layouts/RoleNav";
import Till from "./pages/Till";
import CatalogStockAdmin from "./pages/CatalogStockAdmin";
import Settings from "./pages/Settings";
import RewardsAdmin from "./pages/RewardsAdmin";
import PromotionsAdmin from "./pages/PromotionsAdmin";
import CorporateAccountsAdmin from "./pages/CorporateAccountsAdmin";
import CustomersAdmin from "./pages/CustomersAdmin";
import StaffAdmin from "./pages/StaffAdmin";
import Reports from "./pages/Reports";
import Overrides from "./pages/Overrides";
import Dashboard from "./pages/Dashboard";
import Insights from "./pages/Insights";
import BrandFooter from "./components/BrandFooter";

import { getStoredStaff, logout, checkBackendReachable } from "./lib/api";
import { syncPendingSales } from "./lib/db/syncQueue";
import { registerServiceWorker } from "./lib/registerServiceWorker";
import { CartProvider } from "./contexts/CartContext";
import { LocationProvider } from "./contexts/LocationContext";
import { MODULE_BY_PATH, effectiveModules } from "./lib/modules";

// Landing path per role, per build plan Section 5b.
const LANDING_BY_ROLE = {
  cashier: "/till",
  supervisor: "/till",
  admin: "/dashboard",
};

// Placeholder pages -- real implementations ship in their assigned
// build phase. These exist so navigation and routing are provable now.
function Placeholder({ name }) {
  return (
    <div style={{ padding: 32, color: "var(--text-secondary)" }}>
      <p style={{ fontSize: 15 }}>{name}</p>
      <p style={{ fontSize: 13 }}>
        Scaffolded — feature logic pending its build phase.
      </p>
    </div>
  );
}

export default function App() {
  const [staff, setStaff] = useState(() => getStoredStaff());
  const [path, setPath] = useState(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    registerServiceWorker();

    const syncIfOnline = () => {
      if (navigator.onLine) {
        syncPendingSales()
          .then((result) => {
            // Synced offline sales only deduct stock on the server once sync
            // runs (see sync.service.js) — tell any open catalog to refetch
            // so filled/empty/qty_on_hand reflect the just-synced sales.
            if (result?.synced > 0) {
              window.dispatchEvent(
                new CustomEvent("tezipos:sales-synced", { detail: result }),
              );
            }
          })
          .catch((err) => {
            console.warn("Background sync failed:", err.message);
          });
      }
    };

    window.addEventListener("online", syncIfOnline);
    // Also attempt once on app load in case local sales were left from a previous session.
    syncIfOnline();

    // Browser online events are unreliable when only the backend becomes reachable.
    // Poll every 10 seconds while the app is open to pick up reconnections.
    const interval = setInterval(syncIfOnline, 10000);

    return () => {
      window.removeEventListener("online", syncIfOnline);
      clearInterval(interval);
    };
  }, []);

  // Backend reachability probe used for the global connection banner.
  useEffect(() => {
    let cancelled = false;
    let polling = false;
    const runCheck = async () => {
      if (polling) return;
      polling = true;
      const ok = await checkBackendReachable();
      if (!cancelled) setIsOnline(ok);
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

  const handleSignedIn = ({ staff: signedInStaff }) => {
    setStaff(signedInStaff);
    setPath(LANDING_BY_ROLE[signedInStaff.role] || "/till");
  };

  const handleSignOut = () => {
    logout();
    setStaff(null);
    setPath(null);
  };

  if (!staff) {
    return <SignIn onSignedIn={handleSignedIn} />;
  }

  const requestedPath = path || LANDING_BY_ROLE[staff.role] || "/till";
  // Defense-in-depth against a stale/edited path landing on a module this
  // staff member no longer (or never did) have access to -- the nav
  // itself never links to it, but fall back to their landing page rather
  // than rendering the page underneath.
  const allowedModules = effectiveModules(staff);
  const requiredModule = MODULE_BY_PATH[requestedPath];
  const currentPath =
    !requiredModule || allowedModules.includes(requiredModule)
      ? requestedPath
      : LANDING_BY_ROLE[staff.role] || "/till";

  return (
    <CartProvider>
      <LocationProvider staff={staff}>
        <div style={{ minHeight: "100vh", background: "var(--surface-1)" }}>
        {!isOnline && (
          <div className="w-full p-3 bg-warning/15 border-b border-warning/30 text-center">
            <p className="text-warning text-sm font-semibold">
              ⚠ Internet connection required. Some features may be unavailable.
            </p>
          </div>
        )}
        <RoleNav
          staff={staff}
          currentPath={currentPath}
          onNavigate={setPath}
          onSignOut={handleSignOut}
        />
        {currentPath === "/till" ? (
          <Till staff={staff} onNavigate={setPath} />
        ) : currentPath === "/customers" ? (
          <CustomersAdmin staffRole={staff.role} />
        ) : currentPath === "/catalog" || currentPath === "/stock" ? (
          <CatalogStockAdmin staffRole={staff.role} />
        ) : currentPath === "/settings" ? (
          <Settings />
        ) : currentPath === "/rewards" ? (
          <RewardsAdmin />
        ) : currentPath === "/promotions" ? (
          <PromotionsAdmin />
        ) : currentPath === "/corporate" ? (
          <CorporateAccountsAdmin />
        ) : currentPath === "/staff" ? (
          <StaffAdmin staffRole={staff.role} />
        ) : currentPath === "/reports" ? (
          <Reports />
        ) : currentPath === "/overrides" ? (
          <Overrides />
        ) : currentPath === "/dashboard" ? (
          <Dashboard onNavigate={setPath} />
        ) : currentPath === "/insights" ? (
          <Insights onNavigate={setPath} />
        ) : (
          <Placeholder name={currentPath.replace("/", "") || "till"} />
        )}
        {currentPath !== "/till" && <BrandFooter />}
      </div>
      </LocationProvider>
    </CartProvider>
  );
}
