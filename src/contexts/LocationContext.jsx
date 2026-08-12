import { createContext, useContext, useEffect, useState } from "react";
import { listLocations } from "../lib/api";

const LocationContext = createContext(null);

export function LocationProvider({ children, staff }) {
  const [locations, setLocations] = useState([]);
  const [activeLocationId, setActiveLocationId] = useState(() =>
    localStorage.getItem("activeLocationId") || "",
  );

  useEffect(() => {
    let cancelled = false;
    listLocations()
      .then((data) => {
        if (!cancelled) {
          setLocations(data || []);
          if (!activeLocationId && data?.length && staff?.locationId) {
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
  }, [staff?.locationId]);

  const setLocation = (id) => {
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
