import { useState, useEffect, useCallback } from "react";
import { createCustomer, getCustomerPoints, getCorporatePricing } from "../lib/api";
import {
  searchCustomersWithFallback,
  addCustomerToCache,
} from "../lib/cache/customerCache";
import { setSaleCustomer } from "../lib/saleOperations";
import { useCart } from "../contexts/CartContext";

const WALKIN_CUSTOMER = { id: null, name: "Walk-in Customer", phone: "" };

export default function CustomerSelector() {
  const { saleId, saleLocalId, customer, setCustomer, setCorporatePricing } = useCart();
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [error, setError] = useState("");
  const [pointsBalance, setPointsBalance] = useState(null);

  useEffect(() => {
    if (customer?.id && navigator.onLine) {
      getCustomerPoints(customer.id)
        .then((data) => setPointsBalance(data.balance))
        .catch(() => setPointsBalance(null));
    } else {
      setPointsBalance(null);
    }
  }, [customer?.id]);

  useEffect(() => {
    if (searchInput.length > 2) {
      searchCustomerList();
    } else {
      setSearchResults([]);
    }
  }, [searchInput]);

  const searchCustomerList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await searchCustomersWithFallback(searchInput);
      setSearchResults(results);
    } catch (err) {
      setError(err.message);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchInput]);

  const loadCorporatePricing = async (cust) => {
    if (!cust?.corporate_account_id) {
      setCorporatePricing({});
      return;
    }
    try {
      const pricing = await getCorporatePricing(cust.corporate_account_id);
      const map = {};
      pricing.forEach((p) => {
        map[p.product_id] = parseFloat(p.custom_price);
      });
      setCorporatePricing(map);
    } catch {
      setCorporatePricing({});
    }
  };

  const handleSelectCustomer = async (cust) => {
    if (saleLocalId) {
      try {
        await setSaleCustomer(saleId, saleLocalId, cust);
      } catch (err) {
        setError(err.message || "Failed to link customer to sale");
        return;
      }
    }
    setCustomer(cust);
    await loadCorporatePricing(cust);
    setSearchInput("");
    setSearchResults([]);
  };

  const handleWalkIn = async () => {
    if (saleLocalId) {
      try {
        await setSaleCustomer(saleId, saleLocalId, null);
      } catch (err) {
        setError(err.message || "Failed to set walk-in customer");
        return;
      }
    }
    setCustomer(WALKIN_CUSTOMER);
    setCorporatePricing({});
    setSearchInput("");
    setSearchResults([]);
  };

  const handleClearCustomer = async () => {
    if (saleLocalId) {
      try {
        await setSaleCustomer(saleId, saleLocalId, null);
      } catch (err) {
        setError(err.message || "Failed to clear customer");
        return;
      }
    }
    setCustomer(null);
    setCorporatePricing({});
  };

  const handleCreateCustomer = async () => {
    if (!newPhone) {
      setError("Phone number is required");
      return;
    }
    if (!consentGiven) {
      setError("The customer must consent to their data being retained before registering");
      return;
    }

    setLoading(true);
    setError("");
    try {
      let newCust;
      if (navigator.onLine) {
        newCust = await createCustomer(newPhone, newName, { consentGiven, smsOptIn });
      } else {
        newCust = {
          id: null,
          local_id: `cust-${Date.now()}`,
          name: newName || "New Customer",
          phone: newPhone,
          created_offline: true,
        };
      }
      await addCustomerToCache(newCust);
      if (saleLocalId) {
        await setSaleCustomer(saleId, saleLocalId, newCust);
      }
      setCustomer(newCust);
      setNewPhone("");
      setNewName("");
      setConsentGiven(false);
      setSmsOptIn(true);
      setShowCreateForm(false);
      setSearchInput("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedName = customer?.name || "Walk-in Customer";
  const selectedPhone = customer?.phone || "";
  const hasCustomer = Boolean(customer);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-textSecondary text-xs font-semibold uppercase tracking-wide">
        Customer
      </h3>

      {hasCustomer ? (
        <div className="flex items-center justify-between p-3 rounded-xl bg-surface1 border border-borderColor">
          <div className="min-w-0">
            <p className="text-textPrimary font-semibold truncate">{selectedName}</p>
            {selectedPhone && (
              <p className="text-textMuted text-sm truncate">{selectedPhone}</p>
            )}
            {pointsBalance !== null && (
              <p className="text-textMuted text-xs mt-0.5">
                {pointsBalance} points
              </p>
            )}
          </div>
          <button
            onClick={handleClearCustomer}
            className="ml-3 px-3 py-1.5 rounded-lg text-sm font-medium text-textSecondary hover:text-textPrimary hover:bg-surface3 transition-colors shrink-0">
            Change
          </button>
        </div>
      ) : null}

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted">🔍</span>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search customer..."
          className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-surface1 border border-borderColor text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
        />
        {searchInput && (
          <button
            onClick={() => {
              setSearchInput("");
              setSearchResults([]);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-textMuted hover:text-textPrimary rounded-full hover:bg-surface3 transition-colors text-xs">
            ✕
          </button>
        )}
      </div>

      {!hasCustomer && (
        <button
          onClick={handleWalkIn}
          className="w-full py-2.5 px-4 rounded-xl border border-borderColor bg-surface1 text-textPrimary font-semibold text-sm hover:bg-surface3 hover:border-borderStrong transition-all active:scale-[0.98]">
          Walk-in Customer
        </button>
      )}

      {error && (
        <div className="p-2.5 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold">
          {error}
        </div>
      )}

      {loading && <div className="text-textSecondary text-sm">Searching...</div>}

      {searchResults.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
          {searchResults.map((cust) => (
            <button
              key={cust.id}
              onClick={() => handleSelectCustomer(cust)}
              className="flex flex-col items-start p-3 rounded-xl bg-surface1 border border-borderColor text-left hover:border-borderStrong hover:bg-surface3 transition-all">
              <span className="text-textPrimary font-medium text-sm">
                {cust.name || "Walk-in"}
              </span>
              <span className="text-textMuted text-xs">{cust.phone}</span>
            </button>
          ))}
        </div>
      )}

      {!loading && searchInput.length > 2 && searchResults.length === 0 && (
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface1 border border-borderColor">
          <p className="text-textSecondary text-sm">No customer found</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold hover:bg-primaryDark transition-colors active:scale-[0.98]">
            + New Customer
          </button>
        </div>
      )}

      {showCreateForm && (
        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-surface1 border border-borderColor">
          <h4 className="text-textPrimary font-semibold text-sm">New Customer</h4>
          <input
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Phone (e.g. +254712345678)"
            className="w-full px-3 py-2.5 rounded-xl bg-surface2 border border-borderColor text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (optional)"
            className="w-full px-3 py-2.5 rounded-xl bg-surface2 border border-borderColor text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
          />
          <label className="flex items-start gap-2 text-xs text-textSecondary">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary shrink-0"
            />
            <span>
              Customer consents to their phone number/name being retained for loyalty and receipts (required).
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs text-textSecondary">
            <input
              type="checkbox"
              checked={smsOptIn}
              onChange={(e) => setSmsOptIn(e.target.checked)}
              className="w-4 h-4 accent-primary shrink-0"
            />
            <span>Opt in to promotional SMS (points/receipts always send regardless)</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleCreateCustomer}
              disabled={loading || !consentGiven}
              className="flex-1 py-2 rounded-xl bg-primary text-onPrimary text-sm font-semibold hover:bg-primaryDark transition-colors disabled:opacity-50 active:scale-[0.98]">
              {loading ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewPhone("");
                setNewName("");
                setConsentGiven(false);
                setSmsOptIn(true);
              }}
              className="flex-1 py-2 rounded-xl border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors active:scale-[0.98]">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
