import { Fragment, useEffect, useRef, useState } from "react";
import {
  listCorporateAccounts,
  createCorporateAccount,
  updateCorporateCreditLimit,
  getCorporatePricing,
  setCorporatePricing,
  removeCorporatePricing,
  listCorporateInvoices,
  getInvoiceDetails,
  generateConsolidatedInvoice,
  recordInvoicePayment,
  searchCustomers,
  createCustomer,
  getProducts,
  initiateM2pesa,
  getM2pesaStatus,
  getBusinessConfig,
} from "../lib/api";
import Checkmark from "../components/Checkmark";

const formatKes = (amount) =>
  `KES ${parseFloat(amount || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatInvoiceDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatInvoiceSerial = (invoice) => {
  const invoiceDate = invoice?.created_at
    ? new Date(invoice.created_at)
    : new Date();
  const dateStamp = [
    invoiceDate.getFullYear(),
    String(invoiceDate.getMonth() + 1).padStart(2, "0"),
    String(invoiceDate.getDate()).padStart(2, "0"),
  ].join("");

  return `INV-${dateStamp}-${String(invoice?.id || 0).padStart(4, "0")}`;
};

const escapeHtml = (str) =>
  String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const buildInvoiceHtml = (invoice, account, config = {}) => {
  const serial = formatInvoiceSerial(invoice);
  const customerName = account?.customer_name || "Corporate customer";
  const customerPhone = account?.customer_phone || "—";
  const businessName = config.business_name || "TeziPOS";
  const businessTagline = config.business_tagline || "";
  const logoUrl = config.business_logo_url || "";
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" class="logo" alt="${escapeHtml(businessName)}" />`
    : `<div class="logo">${escapeHtml(businessName.slice(0, 2).toUpperCase())}</div>`;
  const issueDate = formatInvoiceDate(invoice?.created_at || new Date());
  const dueDate = formatInvoiceDate(
    invoice?.due_date ||
      invoice?.covers_up_to ||
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  );

  const sales = invoice?.sales || [];

  const salesSummaryHtml = (() => {
    if (invoice?.type !== "consolidated" || sales.length <= 1) return "";
    const rows = sales
      .map(
        (sale) => `
          <div class="summary-row">
            <span>S-${sale.id}</span>
            <span>${formatInvoiceDate(sale.created_at)}</span>
            <span class="summary-amount">${formatKes(sale.total)}</span>
          </div>
        `,
      )
      .join("");
    return `
      <div class="summary-table">
        <div class="summary-header">
          <span>Sale</span>
          <span>Date</span>
          <span class="summary-amount">Amount</span>
        </div>
        ${rows}
      </div>
    `;
  })();

  const itemsHtml = (() => {
    const allItems = sales.flatMap((sale) =>
      (sale.items || []).map((item) => ({ ...item, saleId: sale.id })),
    );
    if (allItems.length === 0) {
      return '<p class="value">No line items available.</p>';
    }
    const rows = allItems
      .map(
        (item) => `
          <div class="items-row">
            <span class="items-sale">S-${item.saleId}</span>
            <span class="items-desc">${escapeHtml(item.product_name || item.cylinder_brand || "Unknown")}</span>
            <span class="items-qty text-center">${Number(item.quantity || 0).toFixed(2)}</span>
            <span class="items-amount">${formatKes(item.line_total)}</span>
          </div>
        `,
      )
      .join("");
    return `
      <div class="items-table">
        <div class="items-header">
          <span>Sale</span>
          <span>Description</span>
          <span class="items-qty text-center">Qty</span>
          <span class="items-amount">Amount</span>
        </div>
        ${rows}
      </div>
    `;
  })();

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${serial}</title>
        <style>
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            background: #f5f7fb;
            color: #111827;
            padding: 28px;
          }
          .invoice {
            max-width: 840px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #dfe3eb;
            border-radius: 18px;
            padding: 32px;
            box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 18px;
            margin-bottom: 20px;
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .logo {
            width: 72px;
            height: 72px;
            border-radius: 16px;
            background: linear-gradient(135deg, #f3f4f6, #dfe7ef);
            border: 1px solid #d1d5db;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            color: #374151;
            font-size: 12px;
            text-transform: uppercase;
            object-fit: contain;
          }
          .business-name {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.03em;
          }
          .business-meta {
            margin: 4px 0 0;
            font-size: 12px;
            color: #4b5563;
          }
          .invoice-meta {
            text-align: right;
          }
          .eyebrow {
            margin: 0;
            font-size: 11px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #6b7280;
          }
          .serial {
            margin: 8px 0 0;
            font-size: 24px;
            font-weight: 700;
          }
          .section-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
            margin-bottom: 18px;
          }
          .card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 14px 16px;
            background: #fafbfc;
          }
          .label {
            display: block;
            margin-bottom: 6px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #6b7280;
          }
          .value {
            font-size: 14px;
            font-weight: 600;
            color: #111827;
          }
          .totals {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
            margin-top: 10px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 16px;
            background: #fff;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
          }
          .totals-row:last-child {
            border-bottom: none;
          }
          .totals-row.total {
            background: #111827;
            color: #fff;
            font-size: 18px;
            font-weight: 700;
          }
          .items-table {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
            margin-top: 18px;
            font-size: 13px;
          }
          .items-header {
            display: grid;
            grid-template-columns: 0.6fr 2fr 0.5fr 0.8fr;
            background: #f3f4f6;
            padding: 10px 14px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
            font-weight: 600;
          }
          .items-row {
            display: grid;
            grid-template-columns: 0.6fr 2fr 0.5fr 0.8fr;
            padding: 10px 14px;
            border-bottom: 1px solid #e5e7eb;
            background: #fff;
          }
          .items-row:last-child {
            border-bottom: none;
          }
          .items-sale {
            color: #6b7280;
            font-size: 11px;
          }
          .items-amount {
            text-align: right;
            font-weight: 600;
          }
          .items-qty {
            text-align: center;
          }
          .summary-table {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
            margin-top: 18px;
            font-size: 13px;
          }
          .summary-header {
            display: grid;
            grid-template-columns: 0.6fr 1.4fr 0.8fr;
            background: #f3f4f6;
            padding: 10px 14px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
            font-weight: 600;
          }
          .summary-row {
            display: grid;
            grid-template-columns: 0.6fr 1.4fr 0.8fr;
            padding: 10px 14px;
            border-bottom: 1px solid #e5e7eb;
            background: #fff;
          }
          .summary-row:last-child {
            border-bottom: none;
          }
          .summary-amount {
            text-align: right;
            font-weight: 600;
          }
          .footer {
            margin-top: 28px;
            font-size: 12px;
            color: #4b5563;
            border-top: 1px solid #e5e7eb;
            padding-top: 12px;
          }
          @media print {
            body {
              background: #fff;
              padding: 0;
            }
            .invoice {
              box-shadow: none;
              border: none;
              border-radius: 0;
              max-width: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice">
          <div class="header">
            <div class="brand">
              ${logoHtml}
              <div>
                <h1 class="business-name">${escapeHtml(businessName)}</h1>
                <p class="business-meta">${escapeHtml(businessTagline)}</p>
              </div>
            </div>
            <div class="invoice-meta">
              <p class="eyebrow">Invoice</p>
              <div class="serial">${serial}</div>
            </div>
          </div>

          <div class="section-grid">
            <div class="card">
              <span class="label">Bill To</span>
              <div class="value">${customerName}</div>
              <div class="value" style="margin-top: 6px;">${customerPhone}</div>
            </div>
            <div class="card">
              <span class="label">Invoice Details</span>
              <div class="value">Type: ${invoice?.type || "transaction"}</div>
              <div class="value" style="margin-top: 6px;">Status: ${invoice?.status || "unpaid"}</div>
            </div>
          </div>

          <div class="section-grid">
            <div class="card">
              <span class="label">Issue Date</span>
              <div class="value">${issueDate}</div>
            </div>
            <div class="card">
              <span class="label">Due Date</span>
              <div class="value">${dueDate}</div>
            </div>
          </div>

          ${salesSummaryHtml}

          <p class="label" style="margin: 18px 0 8px;">Detailed line items</p>

          ${itemsHtml}

          <div class="totals">
            <div class="totals-row">
              <span>Invoice total</span>
              <span>${formatKes(invoice?.total || 0)}</span>
            </div>
            <div class="totals-row">
              <span>Amount paid</span>
              <span>${formatKes(invoice?.paid_amount || 0)}</span>
            </div>
            <div class="totals-row">
              <span>Balance due</span>
              <span>${formatKes(Math.max(0, (parseFloat(invoice?.total || 0) || 0) - (parseFloat(invoice?.paid_amount || 0) || 0)))}</span>
            </div>
            <div class="totals-row total">
              <span>Grand total</span>
              <span>${formatKes(invoice?.total || 0)}</span>
            </div>
          </div>

          <div class="footer">
            <strong>Notes:</strong> This invoice was generated for the corporate account and is intended for PDF export and record keeping.
          </div>
        </div>
      </body>
    </html>
  `;
};

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
      setError(
        "The customer must consent to their data being retained before registering",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const customer = await createCustomer(phone, name, {
        consentGiven,
        smsOptIn,
      });
      onCreated(customer);
    } catch (err) {
      setError(err.message || "Failed to register customer");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";

  // Rendered inside RegisterForm's own <form>, so this stays a <div> with a
  // manual Enter handler rather than nesting a second <form> (invalid HTML).
  const handleFieldKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!saving && consentGiven) submit();
    }
  };

  return (
    <div className="mt-1 p-3 rounded-lg bg-surface1 border border-borderColor space-y-2">
      <p className="text-textSecondary text-xs font-semibold">
        Register a new customer
      </p>
      <input
        className={input}
        placeholder="Phone (e.g. +254712345678)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        onKeyDown={handleFieldKeyDown}
      />
      <input
        className={input}
        placeholder="Name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleFieldKeyDown}
      />
      <label className="flex items-start gap-2 text-xs text-textSecondary">
        <input
          type="checkbox"
          checked={consentGiven}
          onChange={(e) => setConsentGiven(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-primary shrink-0"
        />
        <span>
          Customer consents to their phone number/name being retained (required
          — Data Protection Act).
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
          type="button"
          onClick={submit}
          disabled={saving || !consentGiven}
          className="px-3 py-1.5 rounded-lg bg-primary text-onPrimary font-semibold text-xs disabled:opacity-50">
          {saving ? "Creating..." : "Create & select"}
        </button>
        <button
          type="button"
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
      searchCustomers(customerQuery)
        .then(setResults)
        .catch(() => setResults([]));
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!saving) submit();
      }}
      className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl bg-surface2 border border-borderColor p-4">
      {selectedCustomer ? (
        <div className="md:col-span-1 flex items-center justify-between px-3 py-2 rounded-lg bg-surface1 border border-borderColor">
          <div>
            <p className="text-textPrimary text-sm font-semibold">
              {selectedCustomer.name || "Unnamed"}
            </p>
            <p className="text-textMuted text-xs">{selectedCustomer.phone}</p>
          </div>
          <button
            type="button"
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
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setResults([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-surface3 text-sm">
                      <span className="text-textPrimary font-medium">
                        {c.name || "Unnamed"}
                      </span>
                      <span className="text-textMuted"> · {c.phone}</span>
                      {c.corporate_account_id && (
                        <span className="text-warning text-xs ml-2">
                          already corporate
                        </span>
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
        type="submit"
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm disabled:opacity-50">
        {saving ? "Registering..." : "Register corporate account"}
      </button>
      {error && (
        <p className="md:col-span-3 text-danger text-xs font-semibold">
          {error}
        </p>
      )}
    </form>
  );
}

function PaymentModal({ open, invoiceId, amountDue, onClose, onSubmit, status }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [mpesaPhone, setMpesaPhone] = useState("");

  useEffect(() => {
    if (open && amountDue) {
      setAmount(String(parseFloat(amountDue || 0).toFixed(2)));
      setMethod("cash");
      setMpesaPhone("");
    }
  }, [open, amountDue]);

  if (!open) return null;

  const submit = () => {
    const numeric = Number.parseFloat(amount);
    if (!amount || Number.isNaN(numeric) || numeric <= 0) {
      return;
    }
    if (method === "mpesa" && !mpesaPhone.trim()) {
      return;
    }
    onSubmit({
      invoiceId,
      amount: numeric,
      method,
      phone: method === "mpesa" ? mpesaPhone.trim() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="w-full max-w-md rounded-2xl bg-surface1 border border-borderColor p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-textMuted">
              Record payment
            </p>
            <h3 className="text-xl font-bold text-textPrimary">
              Invoice #{invoiceId}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-textMuted hover:text-textPrimary text-sm">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-surface2 border border-borderColor p-3">
            <p className="text-xs text-textMuted uppercase tracking-[0.14em]">
              Balance due
            </p>
            <p className="mt-1 text-lg font-bold text-primary">
              {formatKes(amountDue)}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-textSecondary mb-1">
              Amount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg bg-surface2 border border-borderColor px-3 py-2 text-textPrimary"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-textSecondary mb-1">
              Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["cash", "mpesa", "account"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMethod(option)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide border ${
                    method === option
                      ? "bg-primary text-onPrimary border-primary"
                      : "bg-surface2 text-textSecondary border-borderColor"
                  }`}>
                  {option}
                </button>
              ))}
            </div>
          </div>

          {method === "mpesa" && (
            <div>
              <label className="block text-xs font-medium text-textSecondary mb-1">
                M-Pesa phone
              </label>
              <input
                type="tel"
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(e.target.value)}
                className="w-full rounded-lg bg-surface2 border border-borderColor px-3 py-2 text-textPrimary"
                placeholder="e.g. 0712345678"
              />
            </div>
          )}
        </div>

        {status && (
          <p className={`mt-4 text-sm rounded-lg px-3 py-2 flex items-center gap-2 ${
            status.toLowerCase().includes("received") ||
            status.toLowerCase().includes("confirmed")
              ? "bg-success/10 text-success border border-success/30"
              : "bg-surface2 text-textSecondary border border-borderColor"
          }`}>
            {(status.toLowerCase().includes("received") ||
              status.toLowerCase().includes("confirmed")) && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-success text-onPrimary">
                <Checkmark className="w-3 h-3" />
              </span>
            )}
            {status}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-primary text-onPrimary text-xs font-semibold">
            Save payment
          </button>
        </div>
      </form>
    </div>
  );
}

function AccountDetail({ account, onUpdated, onClose, businessConfig }) {
  const [creditLimit, setCreditLimit] = useState(account.credit_limit);
  const [savingLimit, setSavingLimit] = useState(false);
  const [pricing, setPricing] = useState([]);
  const [products, setProducts] = useState([]);
  const [newProductId, setNewProductId] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [coversUpTo, setCoversUpTo] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentModal, setPaymentModal] = useState({
    open: false,
    invoiceId: null,
    amountDue: 0,
  });
  const [message, setMessage] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const mpesaPollRef = useRef(null);

  const messageTone = (() => {
    const text = (message || "").toLowerCase();
    if (
      text.includes("failed") ||
      text.includes("not completed") ||
      text.includes("check again")
    ) {
      return "border-danger/30 bg-danger/10 text-danger";
    }
    if (
      text.includes("confirmed") ||
      text.includes("recorded") ||
      text.includes("success")
    ) {
      return "border-success/30 bg-success/10 text-success";
    }
    if (
      text.includes("waiting") ||
      text.includes("sent") ||
      text.includes("pending")
    ) {
      return "border-warning/30 bg-warning/10 text-warning";
    }
    return "border-primary/20 bg-primary/5 text-textPrimary";
  })();

  const stopMpesaPolling = () => {
    if (mpesaPollRef.current) {
      clearInterval(mpesaPollRef.current);
      mpesaPollRef.current = null;
    }
  };

  useEffect(() => () => stopMpesaPolling(), []);

  useEffect(() => {
    const id = selectedInvoice?.id;
    if (!id || selectedInvoice.sales) return;
    setMessage("");
    getInvoiceDetails(id)
      .then((details) =>
        setSelectedInvoice({
          ...details.invoice,
          sales: details.sales,
        }),
      )
      .catch((err) => setMessage(err.message || "Failed to load invoice details"));
  }, [selectedInvoice?.id]);

  const load = () => {
    getCorporatePricing(account.id)
      .then(setPricing)
      .catch(() => setPricing([]));
    listCorporateInvoices(account.id)
      .then(setInvoices)
      .catch(() => setInvoices([]));
  };

  useEffect(() => {
    load();
    getProducts()
      .then(setProducts)
      .catch(() => setProducts([]));
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
      const updated = await setCorporatePricing(
        account.id,
        newProductId,
        newPrice,
      );
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

  const payInvoice = async (
    invoiceId,
    amountDue,
    method = "cash",
    amountOverride = null,
    phone = "",
  ) => {
    const amount = amountOverride ?? Number.parseFloat(amountDue || 0);
    if (!amount || Number.isNaN(amount) || amount <= 0) return;

    if (method === "mpesa") {
      if (!phone || !phone.trim()) {
        setPaymentStatus("Phone number is required for M-Pesa payments.");
        return;
      }
      try {
        setPaymentStatus("Sending M-Pesa STK push...");
        const transaction = await initiateM2pesa(phone.trim(), amount);
        const mpesaTransactionId = transaction?.mpesa_transaction_id;
        if (!mpesaTransactionId) {
          throw new Error("M-Pesa request was not created.");
        }

        stopMpesaPolling();
        let pollCount = 0;
        const maxPolls = 30;

        mpesaPollRef.current = setInterval(async () => {
          try {
            pollCount += 1;
            const status = await getM2pesaStatus(mpesaTransactionId);
            const resultCode = status?.resultCode ?? status?.ResultCode ?? "";

            if (status?.pending === false || resultCode !== "") {
              stopMpesaPolling();
              if (resultCode === "0" || status?.resultCode === "0") {
                await recordInvoicePayment(invoiceId, amount, "mpesa");
                load();
                onUpdated();
                setPaymentStatus("Payment received");
                setTimeout(() => {
                  setPaymentStatus("");
                  setMessage("M-Pesa payment confirmed and recorded.");
                  setPaymentModal({ open: false, invoiceId: null, amountDue: 0 });
                }, 1500);
              } else {
                setPaymentStatus(
                  status?.resultDesc ||
                    "M-Pesa payment was not completed. Please try again.",
                );
              }
              return;
            }

            if (pollCount >= maxPolls) {
              stopMpesaPolling();
              setPaymentStatus(
                "M-Pesa payment is still pending. Please check again.",
              );
            }
          } catch (err) {
            stopMpesaPolling();
            setPaymentStatus(err.message || "M-Pesa status check failed.");
          }
        }, 3000);

        setPaymentStatus("STK push sent. Waiting for customer confirmation...");
        return;
      } catch (err) {
        setPaymentStatus(err.message || "Failed to send M-Pesa request");
        return;
      }
    }

    try {
      await recordInvoicePayment(invoiceId, amount, method);
      load();
      onUpdated();
      setPaymentStatus("Payment received");
      setTimeout(() => {
        setPaymentStatus("");
        setMessage("Payment recorded.");
        setPaymentModal({ open: false, invoiceId: null, amountDue: 0 });
      }, 1500);
    } catch (err) {
      setPaymentStatus(err.message || "Failed to record payment");
    }
  };

  const input =
    "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";
  const availableCredit =
    parseFloat(account.credit_limit) - parseFloat(account.current_balance);

  const printInvoice = async (invoice) => {
    const printWindow = window.open("", "_blank", "width=1000,height=900");
    if (!printWindow) {
      setMessage("Please allow pop-ups to download the invoice as PDF.");
      return;
    }

    let detailed = invoice;
    if (!invoice.sales) {
      try {
        const details = await getInvoiceDetails(invoice.id);
        detailed = { ...details.invoice, sales: details.sales };
      } catch (err) {
        printWindow.close();
        setMessage(err.message || "Failed to load invoice details");
        return;
      }
    }

    const invoiceHtml = buildInvoiceHtml(detailed, account, businessConfig);
    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <div className="mt-3 p-4 rounded-2xl bg-surface2 border border-borderColor space-y-4">
      {message && (
        <div className={`rounded-xl border px-3 py-3 ${messageTone}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">
            Payment status
          </p>
          <p className="mt-1 text-sm font-medium flex items-center gap-2">
            {(message.toLowerCase().includes("confirmed") ||
              message.toLowerCase().includes("recorded")) && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-success text-onPrimary">
                <Checkmark className="w-3 h-3" />
              </span>
            )}
            {message}
          </p>
        </div>
      )}

      <PaymentModal
        open={paymentModal.open}
        invoiceId={paymentModal.invoiceId}
        amountDue={paymentModal.amountDue}
        status={paymentStatus}
        onClose={() => {
          setPaymentModal({ open: false, invoiceId: null, amountDue: 0 });
          setPaymentStatus("");
        }}
        onSubmit={({ invoiceId, amount, method, phone }) =>
          payInvoice(invoiceId, paymentModal.amountDue, method, amount, phone)
        }
      />

      {selectedInvoice && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl bg-white text-slate-900 shadow-2xl border border-slate-200 overflow-y-auto my-8">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {businessConfig.business_logo_url ? (
                    <img
                      src={businessConfig.business_logo_url}
                      alt={businessConfig.business_name || "TeziPOS"}
                      className="w-12 h-12 rounded-xl border border-slate-300 bg-slate-200 object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl border border-slate-300 bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 uppercase">
                      {(businessConfig.business_name || "TeziPOSe").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-xl font-bold">
                      {businessConfig.business_name || "TeziPOS"}
                    </p>
                    <p className="text-[11px] text-slate-500 uppercase tracking-[0.12em]">
                      {businessConfig.business_tagline || "Corporate Accounts"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Tax Invoice
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatInvoiceSerial(selectedInvoice)}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Customer
                  </p>
                  <p className="mt-2 font-bold text-slate-900">
                    {account.customer_name}
                  </p>
                  <p className="text-slate-600">{account.customer_phone}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Invoice details
                  </p>
                  <p className="mt-2 text-slate-700">
                    Date: {formatInvoiceDate(selectedInvoice.created_at)}
                  </p>
                  <p className="text-slate-700">
                    Due:{" "}
                    {formatInvoiceDate(
                      selectedInvoice.due_date ||
                        selectedInvoice.covers_up_to ||
                        selectedInvoice.created_at,
                    )}
                  </p>
                  <p className="text-slate-700">
                    Type: {selectedInvoice.type || "transaction"}
                  </p>
                </div>
              </div>

              {selectedInvoice.type === "consolidated" &&
                (selectedInvoice.sales || []).length > 1 && (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-[0.8fr_1.4fr_0.8fr] bg-slate-100 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 px-3 py-2">
                      <span>Sale</span>
                      <span>Date</span>
                      <span className="text-right">Amount</span>
                    </div>
                    {(selectedInvoice.sales || []).map((sale) => (
                      <div
                        key={sale.id}
                        className="grid grid-cols-[0.8fr_1.4fr_0.8fr] items-center px-3 py-3 text-sm border-t border-slate-200">
                        <span className="text-slate-600 text-xs">S-{sale.id}</span>
                        <span className="text-slate-700">
                          {formatInvoiceDate(sale.created_at)}
                        </span>
                        <span className="text-right font-semibold text-slate-900">
                          {formatKes(sale.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

              {selectedInvoice.type === "consolidated" &&
                (() => {
                  const rolled = invoices.filter(
                    (inv) =>
                      inv.consolidated_invoice_id === selectedInvoice.id,
                  );
                  if (rolled.length === 0) return null;
                  return (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="grid grid-cols-[0.8fr_1.4fr_0.8fr] bg-slate-100 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 px-3 py-2">
                        <span>Invoice</span>
                        <span>Date</span>
                        <span className="text-right">Total</span>
                      </div>
                      {rolled.map((inv) => (
                        <div
                          key={inv.id}
                          className="grid grid-cols-[0.8fr_1.4fr_0.8fr] items-center px-3 py-3 text-sm border-t border-slate-200">
                          <span className="text-slate-600 text-xs">
                            #{formatInvoiceSerial(inv)}
                          </span>
                          <span className="text-slate-700">
                            {formatInvoiceDate(inv.created_at)}
                          </span>
                          <span className="text-right font-semibold text-slate-900">
                            {formatKes(inv.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Detailed line items
              </p>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-[0.5fr_1.4fr_0.6fr_0.8fr] bg-slate-100 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 px-3 py-2">
                  <span>Sale</span>
                  <span>Description</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Amount</span>
                </div>
                {(selectedInvoice.sales || []).length === 0 && (
                  <div className="px-3 py-3 text-sm text-slate-600 border-t border-slate-200">
                    No line items available.
                  </div>
                )}
                {(selectedInvoice.sales || []).flatMap((sale) =>
                  (sale.items || []).map((item, idx) => (
                    <div
                      key={`${sale.id}-${item.id || idx}`}
                      className="grid grid-cols-[0.5fr_1.4fr_0.6fr_0.8fr] items-center px-3 py-3 text-sm border-t border-slate-200">
                      <span className="text-slate-600 text-xs">S-{sale.id}</span>
                      <span className="font-medium text-slate-900">
                        {item.product_name || item.cylinder_brand || "Unknown"}
                      </span>
                      <span className="text-center text-slate-700">
                        {Number(item.quantity || 0).toFixed(2)}
                      </span>
                      <span className="text-right font-semibold text-slate-900">
                        {formatKes(item.line_total)}
                      </span>
                    </div>
                  )),
                )}
              </div>

              <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
                <div className="flex items-center justify-between text-slate-700">
                  <span>Subtotal</span>
                  <span>{formatKes(selectedInvoice.total)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Paid</span>
                  <span>{formatKes(selectedInvoice.paid_amount || 0)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-base font-bold text-slate-900">
                  <span>Balance due</span>
                  <span>
                    {formatKes(
                      Math.max(
                        0,
                        (parseFloat(selectedInvoice.total || 0) || 0) -
                          (parseFloat(selectedInvoice.paid_amount || 0) || 0),
                      ),
                    )}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 text-[11px] text-slate-500">
                <p className="font-semibold uppercase tracking-[0.12em] text-slate-600 mb-1">
                  Notes
                </p>
                {selectedInvoice.consolidated_invoice_id ? (
                  <p>
                    This invoice was rolled into consolidated invoice #
                    {selectedInvoice.consolidated_invoice_id}.
                  </p>
                ) : (
                  <p>
                    Thank you for your business. This invoice is for the corporate
                    account statement and is intended for PDF export and record
                    keeping.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-3 py-2 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold">
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => printInvoice(selectedInvoice)}
                  className="px-3 py-2 rounded-lg bg-primary text-onPrimary text-xs font-semibold">
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-surface1 border border-borderColor">
          <p className="text-textMuted text-xs">Running balance</p>
          <p className="text-textPrimary font-bold">
            {formatKes(account.current_balance)}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-surface1 border border-borderColor">
          <p className="text-textMuted text-xs">Available credit</p>
          <p
            className={`font-bold ${availableCredit < 0 ? "text-danger" : "text-success"}`}>
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
            <p className="text-textMuted text-xs">
              No custom prices set — standard pricing applies.
            </p>
          )}
          {pricing.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-sm p-2 rounded-lg bg-surface1 border border-borderColor">
              <span className="text-textPrimary">
                {p.product_name} — standard {formatKes(p.standard_price)}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-primary font-semibold">
                  {formatKes(p.custom_price)}
                </span>
                <button
                  onClick={() => removePricing(p.product_id)}
                    className="px-3 py-2 rounded-lg border border-borderColor text-textSecondary text-xs font-semibold hover:bg-surface3 shrink-0">
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
              <option key={p.id} value={p.id}>
                {p.name} (standard {formatKes(p.unit_price)})
              </option>
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
          <button
            onClick={addPricing}
            className="px-3 py-2 rounded-lg border border-borderColor text-textSecondary text-xs font-semibold hover:bg-surface3 shrink-0">
            Set price
          </button>
        </div>
      </div>

      <div>
        <p className="text-textSecondary text-xs font-semibold uppercase tracking-wide mb-2">
          Invoices
        </p>
        <div className="flex gap-2 items-center mb-2">
          <input
            className={input}
            type="date"
            value={coversUpTo}
            onChange={(e) => setCoversUpTo(e.target.value)}
          />
          <button
            onClick={generateConsolidated}
            className="px-3 py-2 rounded-lg bg-primary text-onPrimary text-xs font-semibold shrink-0">
            Generate consolidated statement up to date
          </button>
        </div>
        <p className="text-textMuted text-xs mb-2">
          Per-transaction invoices are generated from the sale/receipt itself
          once a sale is charged to this account.
        </p>
        <div className="rounded-xl overflow-hidden border border-borderColor">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface2 text-textSecondary">
                <tr>
                  <th className="p-2 text-left font-semibold">Invoice</th>
                  <th className="p-2 text-left font-semibold">Type</th>
                  <th className="p-2 text-right font-semibold">Total</th>
                  <th className="p-2 text-left font-semibold">Status</th>
                  <th className="p-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-textMuted text-xs">
                      No invoices yet.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-borderColor text-textPrimary">
                      <td className="p-2">
                        #{inv.id}
                        {inv.covers_up_to && (
                          <span className="text-textMuted">
                            {" "}
                            (up to {inv.covers_up_to.slice(0, 10)})
                          </span>
                        )}
                      </td>
                      <td className="p-2 capitalize">{inv.type}</td>
                      <td className="p-2 text-right">
                        {formatKes(inv.total)}
                        {inv.status === "partial" && (
                          <span className="text-warning block text-xs">
                            {formatKes(Math.max(0, parseFloat(inv.total || 0) - parseFloat(inv.paid_amount || 0)))} due
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        <span
                          className={`text-xs font-semibold capitalize ${
                            inv.status === "paid"
                              ? "text-success"
                              : inv.status === "partial"
                                ? "text-warning"
                                : inv.status === "consolidated"
                                  ? "text-textMuted"
                                  : "text-danger"
                          }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="px-3 py-2 rounded-lg border border-borderColor text-textSecondary text-xs font-semibold hover:bg-surface3 shrink-0">
                            View invoice
                          </button>
                          {inv.status !== "consolidated" && (
                            <button
                              onClick={() => printInvoice(inv)}
                              className="px-3 py-2 rounded-lg border border-borderColor text-textSecondary text-xs font-semibold hover:bg-surface3 shrink-0">
                              PDF
                            </button>
                          )}
                          {inv.status !== "paid" && inv.status !== "consolidated" && (
                            <button
                              onClick={() =>
                                setPaymentModal({
                                  open: true,
                                  invoiceId: inv.id,
                                  amountDue: Math.max(
                                    0,
                                    parseFloat(inv.total || 0) - parseFloat(inv.paid_amount || 0),
                                  ),
                                })
                              }
                              className="px-3 py-2 rounded-lg border border-borderColor text-textSecondary text-xs font-semibold hover:bg-surface3 shrink-0">
                              Record payment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
  const [businessConfig, setBusinessConfig] = useState({
    business_name: "TeziPOS",
    business_tagline: "",
    business_logo_url: "",
  });

  const load = () =>
    listCorporateAccounts()
      .then(setAccounts)
      .catch((err) => setError(err.message));

  useEffect(() => {
    load();
    getBusinessConfig()
      .then(setBusinessConfig)
      .catch(() => setBusinessConfig({
        business_name: "TeziPOS",
        business_tagline: "",
        business_logo_url: "",
      }));
  }, []);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-textPrimary">
        Corporate Accounts
      </h1>
      <p className="text-textSecondary text-sm mt-1">
        Credit limits and custom pricing are set individually per client —
        nothing here is shared or uniform across accounts.
      </p>

      {error && (
        <p className="mt-4 p-3 rounded-xl bg-danger/10 text-danger text-sm">
          {error}
        </p>
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

      <section className="mt-6">
        <div className="rounded-2xl overflow-hidden border border-borderColor">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface1 text-textSecondary">
                <tr>
                  <th className="p-3 text-left font-semibold">Customer</th>
                  <th className="p-3 text-left font-semibold">Phone</th>
                  <th className="p-3 text-right font-semibold">Balance</th>
                  <th className="p-3 text-right font-semibold">Limit</th>
                  <th className="p-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-textMuted text-sm">
                      No corporate accounts registered yet.
                    </td>
                  </tr>
                ) : (
                  accounts.map((account) => (
                    <Fragment key={account.id}>
                      <tr className="border-t border-borderColor text-textPrimary">
                        <td className="p-3 font-semibold">{account.customer_name}</td>
                        <td className="p-3 text-textSecondary">{account.customer_phone}</td>
                        <td className="p-3 text-right">{formatKes(account.current_balance)}</td>
                        <td className="p-3 text-right">{formatKes(account.credit_limit)}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() =>
                              setExpandedId(expandedId === account.id ? null : account.id)
                            }
                            className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary">
                            {expandedId === account.id ? "Close" : "Manage"}
                          </button>
                        </td>
                      </tr>
                      {expandedId === account.id && (
                        <tr className="border-t border-borderColor">
                          <td colSpan={5} className="p-3 bg-surface1">
                            <AccountDetail
                              account={account}
                              onUpdated={load}
                              onClose={() => setExpandedId(null)}
                              businessConfig={businessConfig}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
