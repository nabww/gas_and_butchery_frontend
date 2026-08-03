import { useEffect, useState } from "react";
import {
  listCorporateAccounts,
  createCorporateAccount,
  updateCorporateCreditLimit,
  getCorporatePricing,
  setCorporatePricing,
  removeCorporatePricing,
  listCorporateInvoices,
  generateConsolidatedInvoice,
  recordInvoicePayment,
  searchCustomers,
  createCustomer,
  getProducts,
} from "../lib/api";

const formatKes = (amount) =>
  `KES ${parseFloat(amount || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function NewCustomerInline({ initialPhone, onCreated, onCancel }) {
  const [phone, setPhone] = useState(initialPhone || "");
  const [name, setName] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!phone) {
      setError("Phone number is required");
      return;
    }
    if (!consentGiven) {
      setError("The customer must consent to their data being retained before registering");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const customer = await createCustomer(phone, name, { consentGiven, smsOptIn });
      onCreated(customer);
    } catch (err) {
      setError(err.message || "Failed to register customer");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";

  return (
    <div className="mt-1 p-3 rounded-lg bg-surface1 border border-borderColor space-y-2">
      <p className="text-textSecondary text-xs font-semibold">Register a new customer</p>
      <input
        className={input}
        placeholder="Phone (e.g. +254712345678)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        className={input}
        placeholder="Name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label className="flex items-start gap-2 text-xs text-textSecondary">
        <input
          type="checkbox"
          checked={consentGiven}
          onChange={(e) => setConsentGiven(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-primary shrink-0"
        />
        <span>
          Customer consents to their phone number/name being retained (required — Data Protection
          Act).
        </span>
      </label>
      <label className="flex items-center gap-2 text-xs text-textSecondary">
        <input
          type="checkbox"
          checked={smsOptIn}
          onChange={(e) => setSmsOptIn(e.target.checked)}
          className="w-4 h-4 accent-primary shrink-0"
        />
        <span>Opt in to promotional SMS</span>
      </label>
      {error && <p className="text-danger text-xs font-semibold">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={saving || !consentGiven}
          className="px-3 py-1.5 rounded-lg bg-primary text-onPrimary font-semibold text-xs disabled:opacity-50">
          {saving ? "Creating..." : "Create & select"}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg border border-borderColor bg-surface2 text-textSecondary font-semibold text-xs hover:bg-surface3 hover:text-textPrimary">
          Cancel
        </button>
      </div>
    </div>
  );
}

function RegisterForm({ onRegistered }) {
  const [customerQuery, setCustomerQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [creditLimit, setCreditLimit] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  useEffect(() => {
    if (customerQuery.length > 2) {
      searchCustomers(customerQuery).then(setResults).catch(() => setResults([]));
    } else {
      setResults([]);
    }
  }, [customerQuery]);

  const submit = async () => {
    if (!selectedCustomer) {
      setError("Select a customer first");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createCorporateAccount(selectedCustomer.id, creditLimit || 0);
      setSelectedCustomer(null);
      setCustomerQuery("");
      setCreditLimit("");
      onRegistered();
    } catch (err) {
      setError(err.message || "Failed to register corporate account");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";

  return (
    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl bg-surface2 border border-borderColor p-4">
      {selectedCustomer ? (
        <div className="md:col-span-1 flex items-center justify-between px-3 py-2 rounded-lg bg-surface1 border border-borderColor">
          <div>
            <p className="text-textPrimary text-sm font-semibold">{selectedCustomer.name || "Unnamed"}</p>
            <p className="text-textMuted text-xs">{selectedCustomer.phone}</p>
          </div>
          <button
            onClick={() => setSelectedCustomer(null)}
            className="text-textMuted hover:text-textPrimary text-xs">
            Change
          </button>
        </div>
      ) : (
        <div className="md:col-span-1">
          {!showNewCustomerForm ? (
            <div className="relative">
              <input
                className={input}
                placeholder="Search customer by name/phone"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
              />
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg bg-surface1 border border-borderColor max-h-48 overflow-y-auto">
                  {results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setResults([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-surface3 text-sm">
                      <span className="text-textPrimary font-medium">{c.name || "Unnamed"}</span>
                      <span className="text-textMuted"> · {c.phone}</span>
                      {c.corporate_account_id && (
                        <span className="text-warning text-xs ml-2">already corporate</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowNewCustomerForm(true)}
                className="mt-1 text-primary text-xs font-semibold hover:underline">
                + Not found? Register a new customer
              </button>
            </div>
          ) : (
            <NewCustomerInline
              initialPhone={customerQuery}
              onCreated={(customer) => {
                setSelectedCustomer(customer);
                setShowNewCustomerForm(false);
                setCustomerQuery("");
                setResults([]);
              }}
              onCancel={() => setShowNewCustomerForm(false)}
            />
          )}
        </div>
      )}
      <input
        className={input}
        type="number"
        min="0"
        step="0.01"
        placeholder="Credit limit (KES)"
        value={creditLimit}
        onChange={(e) => setCreditLimit(e.target.value)}
      />
      <button
        onClick={submit}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm disabled:opacity-50">
        {saving ? "Registering..." : "Register corporate account"}
      </button>
      {error && <p className="md:col-span-3 text-danger text-xs font-semibold">{error}</p>}
    </div>
  );
}

function AccountDetail({ account, onUpdated, onClose }) {
  const [creditLimit, setCreditLimit] = useState(account.credit_limit);
  const [savingLimit, setSavingLimit] = useState(false);
  const [pricing, setPricing] = useState([]);
  const [products, setProducts] = useState([]);
  const [newProductId, setNewProductId] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [coversUpTo, setCoversUpTo] = useState("");
  const [message, setMessage] = useState("");

  const load = () => {
    getCorporatePricing(account.id).then(setPricing).catch(() => setPricing([]));
    listCorporateInvoices(account.id).then(setInvoices).catch(() => setInvoices([]));
  };

  useEffect(() => {
    load();
    getProducts().then(setProducts).catch(() => setProducts([]));
  }, [account.id]);

  const saveCreditLimit = async () => {
    setSavingLimit(true);
    try {
      await updateCorporateCreditLimit(account.id, creditLimit);
      onUpdated();
      onClose();
    } catch (err) {
      setMessage(err.message || "Failed to update credit limit");
      setSavingLimit(false);
    }
  };

  const addPricing = async () => {
    if (!newProductId || !newPrice) return;
    try {
      const updated = await setCorporatePricing(account.id, newProductId, newPrice);
      setPricing(updated);
      setNewProductId("");
      setNewPrice("");
    } catch (err) {
      setMessage(err.message || "Failed to set custom price");
    }
  };

  const removePricing = async (productId) => {
    try {
      const updated = await removeCorporatePricing(account.id, productId);
      setPricing(updated);
    } catch (err) {
      setMessage(err.message || "Failed to remove custom price");
    }
  };

  const generateConsolidated = async () => {
    if (!coversUpTo) {
      setMessage("Pick a date to cover up to");
      return;
    }
    try {
      await generateConsolidatedInvoice(account.id, coversUpTo);
      setCoversUpTo("");
      load();
      onUpdated();
      setMessage("Consolidated invoice generated.");
    } catch (err) {
      setMessage(err.message || "Failed to generate consolidated invoice");
    }
  };

  const payInvoice = async (invoiceId, amountDue) => {
    const amount = window.prompt(`Amount to record against this invoice (balance due: ${formatKes(amountDue)})`);
    if (!amount) return;
    try {
      await recordInvoicePayment(invoiceId, amount, "cash");
      load();
      onUpdated();
      setMessage("Payment recorded.");
    } catch (err) {
      setMessage(err.message || "Failed to record payment");
    }
  };

  const input =
    "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";
  const availableCredit = parseFloat(account.credit_limit) - parseFloat(account.current_balance);

  return (
    <div className="mt-3 p-4 rounded-2xl bg-surface2 border border-borderColor space-y-4">
      {message && (
        <p className="text-textSecondary text-xs">{message}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-surface1 border border-borderColor">
          <p className="text-textMuted text-xs">Running balance</p>
          <p className="text-textPrimary font-bold">{formatKes(account.current_balance)}</p>
        </div>
        <div className="p-3 rounded-lg bg-surface1 border border-borderColor">
          <p className="text-textMuted text-xs">Available credit</p>
          <p className={`font-bold ${availableCredit < 0 ? "text-danger" : "text-success"}`}>
            {formatKes(availableCredit)}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className={input}
            type="number"
            min="0"
            step="0.01"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
          />
          <button
            onClick={saveCreditLimit}
            disabled={savingLimit}
            className="px-3 py-2 rounded-lg bg-primary text-onPrimary text-xs font-semibold disabled:opacity-50 shrink-0">
            Save limit
          </button>
        </div>
      </div>

      <div>
        <p className="text-textSecondary text-xs font-semibold uppercase tracking-wide mb-2">
          Custom pricing (per-client, overrides standard price)
        </p>
        <div className="space-y-1 mb-2">
          {pricing.length === 0 && (
            <p className="text-textMuted text-xs">No custom prices set — standard pricing applies.</p>
          )}
          {pricing.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-surface1 border border-borderColor">
              <span className="text-textPrimary">
                {p.product_name} — standard {formatKes(p.standard_price)}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-primary font-semibold">{formatKes(p.custom_price)}</span>
                <button onClick={() => removePricing(p.product_id)} className="text-textMuted hover:text-danger text-xs">
                  Remove
                </button>
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <select
            className={input}
            value={newProductId}
            onChange={(e) => setNewProductId(e.target.value)}>
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} (standard {formatKes(p.unit_price)})</option>
            ))}
          </select>
          <input
            className={input}
            type="number"
            min="0"
            step="0.01"
            placeholder="Custom price"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
          />
          <button onClick={addPricing} className="px-3 py-2 rounded-lg border border-borderColor text-textSecondary text-xs font-semibold hover:bg-surface3 shrink-0">
            Set price
          </button>
        </div>
      </div>

      <div>
        <p className="text-textSecondary text-xs font-semibold uppercase tracking-wide mb-2">
          Invoices (user-triggered — never auto-generated)
        </p>
        <div className="flex gap-2 mb-2">
          <input
            className={input}
            type="date"
            value={coversUpTo}
            onChange={(e) => setCoversUpTo(e.target.value)}
          />
          <button onClick={generateConsolidated} className="px-3 py-2 rounded-lg bg-primary text-onPrimary text-xs font-semibold shrink-0">
            Generate consolidated statement up to date
          </button>
        </div>
        <p className="text-textMuted text-xs mb-2">
          Per-transaction invoices are generated from the sale/receipt itself once a sale is charged to this account.
        </p>
        <div className="space-y-1">
          {invoices.length === 0 && <p className="text-textMuted text-xs">No invoices yet.</p>}
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-surface1 border border-borderColor">
              <span className="text-textPrimary">
                #{inv.id} · {inv.type} · {formatKes(inv.total)}
                {inv.covers_up_to && <span className="text-textMuted"> (up to {inv.covers_up_to.slice(0, 10)})</span>}
              </span>
              <span className="flex items-center gap-2">
                <span className={`text-xs font-semibold capitalize ${
                  inv.status === "paid" ? "text-success" : inv.status === "partial" ? "text-warning" : "text-danger"
                }`}>
                  {inv.status}
                </span>
                {inv.status !== "paid" && (
                  <button onClick={() => payInvoice(inv.id, inv.total)} className="text-textMuted hover:text-primary text-xs">
                    Record payment
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CorporateAccountsAdmin() {
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    listCorporateAccounts()
      .then(setAccounts)
      .catch((err) => setError(err.message));

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-textPrimary">Corporate Accounts</h1>
      <p className="text-textSecondary text-sm mt-1">
        Credit limits and custom pricing are set individually per client — nothing here is shared or uniform across accounts.
      </p>

      {error && (
        <p className="mt-4 p-3 rounded-xl bg-danger/10 text-danger text-sm">{error}</p>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-6 px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm">
          + Register corporate account
        </button>
      )}
      {showForm && (
        <>
          <RegisterForm
            onRegistered={() => {
              setShowForm(false);
              load();
            }}
          />
          <button
            onClick={() => setShowForm(false)}
            className="px-4 py-2 rounded-lg border border-borderColor bg-surface2 text-textSecondary font-semibold text-sm hover:bg-surface3 hover:text-textPrimary">
            Cancel
          </button>
        </>
      )}

      <section className="mt-6 space-y-2">
        {accounts.length === 0 && (
          <p className="text-textMuted text-sm">No corporate accounts registered yet.</p>
        )}
        {accounts.map((account) => (
          <div key={account.id}>
            <div className="p-3 rounded-xl bg-surface2 border border-borderColor flex justify-between items-center text-sm">
              <div>
                <p className="text-textPrimary font-semibold">{account.customer_name}</p>
                <p className="text-textMuted text-xs">
                  {account.customer_phone} · Balance {formatKes(account.current_balance)} / Limit {formatKes(account.credit_limit)}
                </p>
              </div>
              <button
                onClick={() => setExpandedId(expandedId === account.id ? null : account.id)}
                className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary">
                {expandedId === account.id ? "Close" : "Manage"}
              </button>
            </div>
            {expandedId === account.id && (
              <AccountDetail
                account={account}
                onUpdated={load}
                onClose={() => setExpandedId(null)}
              />
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
