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

import { getStoredStaff, logout } from "./lib/api";
import { syncPendingSales } from "./lib/db/syncQueue";
import { registerServiceWorker } from "./lib/registerServiceWorker";
import { CartProvider } from "./contexts/CartContext";

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

  useEffect(() => {
    registerServiceWorker();

    const syncIfOnline = () => {
      if (navigator.onLine) {
        syncPendingSales().catch((err) => {
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

  const currentPath = path || LANDING_BY_ROLE[staff.role] || "/till";

  return (
    <CartProvider>
      <div style={{ minHeight: "100vh", background: "var(--surface-1)" }}>
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
        ) : (
          <Placeholder name={currentPath.replace("/", "") || "till"} />
        )}
      </div>
    </CartProvider>
  );
}
