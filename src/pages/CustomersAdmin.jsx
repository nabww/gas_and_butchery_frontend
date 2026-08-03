import { useEffect, useState } from "react";
import {
  searchCustomers,
  createCustomer,
  updateCustomer,
  updateCustomerConsent,
  runDpaRetentionCycle,
  getCustomerByPhone,
} from "../lib/api";

const PREFILL_KEY = "tezipos-prefill-customer-phone";

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadges({ customer }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          customer.registered_via === "manual"
            ? "bg-primary/15 text-primary"
            : "bg-textMuted/15 text-textSecondary"
        }`}>
        {customer.registered_via === "manual" ? "Manually registered" : "M-Pesa auto"}
      </span>
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          customer.consent_given_at ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
        }`}>
        {customer.consent_given_at ? "Consent given" : "No consent"}
      </span>
      {customer.purged_at ? (
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-danger/15 text-danger">
          Purged {formatDate(customer.purged_at)}
        </span>
      ) : customer.voided_at ? (
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-danger/15 text-danger">
          Voided {formatDate(customer.voided_at)}
        </span>
      ) : null}
    </div>
  );
}

function RegisterForm({ prefillPhone, onRegistered, onCancel }) {
  const [phone, setPhone] = useState(prefillPhone || "");
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
      await createCustomer(phone, name, { consentGiven, smsOptIn });
      onRegistered();
    } catch (err) {
      setError(err.message || "Failed to register customer");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";

  return (
    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 rounded-2xl bg-surface2 border border-borderColor p-4">
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
      <label className="md:col-span-2 flex items-start gap-2 text-xs text-textSecondary">
        <input
          type="checkbox"
          checked={consentGiven}
          onChange={(e) => setConsentGiven(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-primary shrink-0"
        />
        <span>
          Customer consents to their phone number/name being retained for loyalty, receipts, and
          reporting (required — Data Protection Act).
        </span>
      </label>
      <label className="md:col-span-2 flex items-center gap-2 text-xs text-textSecondary">
        <input
          type="checkbox"
          checked={smsOptIn}
          onChange={(e) => setSmsOptIn(e.target.checked)}
          className="w-4 h-4 accent-primary shrink-0"
        />
        <span>Opt in to promotional SMS (transactional receipts/points always send regardless)</span>
      </label>
      {error && <p className="md:col-span-2 text-danger text-xs font-semibold">{error}</p>}
      <div className="md:col-span-2 flex gap-2">
        <button
          onClick={submit}
          disabled={saving || !consentGiven}
          className="px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm disabled:opacity-50">
          {saving ? "Registering..." : "Register customer"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-borderColor bg-surface1 text-textSecondary font-semibold text-sm hover:bg-surface3 hover:text-textPrimary">
          Cancel
        </button>
      </div>
    </div>
  );
}

function CustomerDetail({ customer, onUpdated, onClose }) {
  const [name, setName] = useState(customer.name || "");
  const [altPhone, setAltPhone] = useState(customer.alt_phone || "");
  const [smsOptIn, setSmsOptIn] = useState(Boolean(customer.sms_opt_in));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    setMessage("");
    try {
      await updateCustomer(customer.id, { name, alt_phone: altPhone || null });
      onUpdated();
      onClose();
    } catch (err) {
      setMessage(err.message || "Failed to update profile");
      setSaving(false);
    }
  };

  const toggleConsent = async (consentGiven) => {
    setSaving(true);
    setMessage("");
    try {
      await updateCustomerConsent(customer.id, { consentGiven });
      setMessage(consentGiven ? "Consent granted." : "Consent revoked.");
      onUpdated();
    } catch (err) {
      setMessage(err.message || "Failed to update consent");
    } finally {
      setSaving(false);
    }
  };

  const toggleSmsOptIn = async () => {
    const next = !smsOptIn;
    setSaving(true);
    setMessage("");
    try {
      await updateCustomerConsent(customer.id, { smsOptIn: next });
      setSmsOptIn(next);
      onUpdated();
    } catch (err) {
      setMessage(err.message || "Failed to update SMS preference");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";

  return (
    <div className="mt-3 p-4 rounded-2xl bg-surface2 border border-borderColor space-y-4">
      {message && <p className="text-textSecondary text-xs">{message}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-textMuted text-xs">Name</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-textMuted text-xs">Alternate phone</label>
          <input
            className={input}
            value={altPhone}
            onChange={(e) => setAltPhone(e.target.value)}
            placeholder="Second SIM, cashier-linked only"
          />
        </div>
      </div>
      <button
        onClick={saveProfile}
        disabled={saving}
        className="px-3 py-2 rounded-lg bg-primary text-onPrimary text-xs font-semibold disabled:opacity-50">
        Save profile
      </button>

      <div className="border-t border-borderColor pt-4 space-y-2">
        <p className="text-textSecondary text-xs font-semibold uppercase tracking-wide">
          Data Protection Act consent
        </p>
        <p className="text-textMuted text-xs">
          {customer.consent_given_at
            ? `Consent given ${formatDate(customer.consent_given_at)}. Retained indefinitely.`
            : customer.registered_via === "mpesa_auto"
              ? "No consent on file — auto-registered from an M-Pesa payment. Subject to the 3-month void / 6-month purge retention job unless consent is granted."
              : "No consent on file."}
        </p>
        <div className="flex gap-2">
          {!customer.consent_given_at ? (
            <button
              onClick={() => toggleConsent(true)}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-success text-onPrimary text-xs font-semibold disabled:opacity-50">
              Grant consent
            </button>
          ) : (
            <button
              onClick={() => toggleConsent(false)}
              disabled={saving}
              className="px-3 py-2 rounded-lg border border-danger/40 text-danger text-xs font-semibold hover:bg-danger/10 disabled:opacity-50">
              Revoke consent
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-borderColor pt-4 space-y-2">
        <p className="text-textSecondary text-xs font-semibold uppercase tracking-wide">
          Promotional SMS
        </p>
        <label className="flex items-center gap-2 text-xs text-textSecondary">
          <input
            type="checkbox"
            checked={smsOptIn}
            onChange={toggleSmsOptIn}
            disabled={saving}
            className="w-4 h-4 accent-primary"
          />
          <span>Opted in to promotional SMS (transactional receipts/points always send regardless)</span>
        </label>
      </div>
    </div>
  );
}

export default function CustomersAdmin({ staffRole }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [prefillPhone, setPrefillPhone] = useState("");
  const [error, setError] = useState("");
  const [retentionMessage, setRetentionMessage] = useState("");
  const [runningRetention, setRunningRetention] = useState(false);

  const handleRunRetentionCycle = async () => {
    setRunningRetention(true);
    setRetentionMessage("");
    try {
      const { voided, purged } = await runDpaRetentionCycle();
      setRetentionMessage(`Retention cycle ran: ${voided} voided, ${purged} purged.`);
      runSearch(query);
    } catch (err) {
      setRetentionMessage(err.message || "Failed to run retention cycle");
    } finally {
      setRunningRetention(false);
    }
  };

  const runSearch = (q) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    searchCustomers(q)
      .then(setResults)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    const prefill = sessionStorage.getItem(PREFILL_KEY);
    if (!prefill) return;
    sessionStorage.removeItem(PREFILL_KEY);
    setQuery(prefill);
    runSearch(prefill);
    // This phone was auto-registered by an M-Pesa payment, so it already
    // exists — jump straight into editing that record (grant consent etc.)
    // instead of showing "Register customer", which would fail with a
    // duplicate-phone error.
    getCustomerByPhone(prefill)
      .then((customer) => setExpandedId(customer.id))
      .catch(() => {
        setPrefillPhone(prefill);
        setShowForm(true);
      });
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-textPrimary">Customers</h1>
      <p className="text-textSecondary text-sm mt-1">
        Registration, consent, and promotional SMS preference. M-Pesa auto-registered customers
        with no consent are voided after 3 months and anonymized after 6 (see DPA retention job).
      </p>

      {error && (
        <p className="mt-4 p-3 rounded-xl bg-danger/10 text-danger text-sm">{error}</p>
      )}

      {staffRole === "admin" && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleRunRetentionCycle}
            disabled={runningRetention}
            className="px-3 py-1.5 rounded-lg border border-borderColor bg-surface1 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary disabled:opacity-50">
            {runningRetention ? "Running..." : "Run DPA retention cycle now"}
          </button>
          {retentionMessage && <p className="text-textMuted text-xs">{retentionMessage}</p>}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <input
          className="flex-1 rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm"
          placeholder="Search by name or phone..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!showForm && (
          <button
            onClick={() => {
              setPrefillPhone("");
              setShowForm(true);
            }}
            className="px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm shrink-0">
            + Register customer
          </button>
        )}
      </div>

      {showForm && (
        <RegisterForm
          prefillPhone={prefillPhone}
          onRegistered={() => {
            setShowForm(false);
            runSearch(query || prefillPhone);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <section className="mt-6 space-y-2">
        {query.length >= 2 && results.length === 0 && (
          <p className="text-textMuted text-sm">No customers found for "{query}".</p>
        )}
        {results.map((customer) => (
          <div key={customer.id}>
            <div className="p-3 rounded-xl bg-surface2 border border-borderColor flex justify-between items-start text-sm">
              <div>
                <p className="text-textPrimary font-semibold">{customer.name || "Unnamed"}</p>
                <p className="text-textMuted text-xs">
                  {customer.phone}
                  {customer.alt_phone && ` · alt: ${customer.alt_phone}`}
                </p>
                <StatusBadges customer={customer} />
              </div>
              <button
                onClick={() => setExpandedId(expandedId === customer.id ? null : customer.id)}
                className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary shrink-0">
                {expandedId === customer.id ? "Close" : "Manage"}
              </button>
            </div>
            {expandedId === customer.id && (
              <CustomerDetail
                customer={customer}
                onUpdated={() => runSearch(query)}
                onClose={() => setExpandedId(null)}
              />
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
