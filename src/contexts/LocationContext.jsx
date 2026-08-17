import { createContext, useContext, useEffect, useState } from "react";
import { listLocations } from "../lib/api";

const LocationContext = createContext(null);

export function LocationProvider({ children, staff }) {
  const [locations, setLocations] = useState([]);
  const [activeLocationId, setActiveLocationId] = useState(() =>
    localStorage.getItem("activeLocationId") || "",
  );

  // Only admins (and supervisors explicitly granted the permission) are
  // allowed to view data for a shop other than the one they're logged into.
  // Everyone else must always be pinned to their own location, regardless
  // of what's cached in localStorage from a previous staff member's session
  // on a shared device -- otherwise a cashier logging in at Branch B on a
  // device last used at Branch A would silently see Branch A's numbers.
  const canSwitchLocation =
    staff?.role === "admin" || (staff?.role === "supervisor" && !!staff?.canSwitchLocation);

  useEffect(() => {
    let cancelled = false;
    listLocations()
      .then((data) => {
        if (!cancelled) {
          setLocations(data || []);
          if (!canSwitchLocation && staff?.locationId) {
            const own = String(staff.locationId);
            if (activeLocationId !== own) {
              setActiveLocationId(own);
              localStorage.setItem("activeLocationId", own);
            }
          } else if (!activeLocationId && data?.length && staff?.locationId) {
            const fallback = String(staff.locationId);
            setActiveLocationId(fallback);
            localStorage.setItem("activeLocationId", fallback);
          }
        }
      })
      .catch((err) => console.warn("Failed to load locations", err));
    return () => {
      cancelled = true;
    };
  }, [staff?.locationId, canSwitchLocation]);

  const setLocation = (id) => {
    // Defense in depth: the location switcher UI is already hidden from
    // staff without permission, but never let a restricted staff member's
    // view be pinned to anything but their own location.
    if (!canSwitchLocation) return;
    // Changing the viewed shop swaps out stock, sales, and reporting data
    // across every page at once. Rather than trying to make every component
    // react correctly to the switch, persist the choice and reload — this
    // also matters for offline-first pages that may hold stale in-memory
    // state from IndexedDB-backed queries tied to the previous location.
    if (id) localStorage.setItem("activeLocationId", id);
    else localStorage.removeItem("activeLocationId");
    if (id !== activeLocationId) {
      window.location.reload();
      return;
    }
    setActiveLocationId(id);
  };

  return (
    <LocationContext.Provider value={{ locations, activeLocationId, setActiveLocationId: setLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useActiveLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useActiveLocation must be used within LocationProvider");
  return ctx;
}
