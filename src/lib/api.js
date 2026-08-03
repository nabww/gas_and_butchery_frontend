import { cacheCredential, verifyOfflinePin } from "./auth/credentialCache";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV
    ? "/api"
    : `${window.location.protocol}//${window.location.hostname}:4000/api`);
const TOKEN_KEY = "tezipos-token";
const STAFF_KEY = "tezipos-staff";

export async function login(pin) {
  const tryOfflineFallback = async () => {
    const offline = await verifyOfflinePin(pin);
    if (offline) {
      localStorage.setItem(TOKEN_KEY, offline.token);
      localStorage.setItem(STAFF_KEY, JSON.stringify(offline.staff));
      return { staff: offline.staff, token: offline.token, offline: true };
    }
    return null;
  };

  let res;
  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
  } catch (networkErr) {
    // Server unreachable — try offline credential cache
    const offline = await tryOfflineFallback();
    if (offline) return offline;
    throw new Error(
      "Cannot reach server and no cached credentials found for this PIN. " +
      "Sign in online first to enable offline access."
    );
  }

  let data = null;
  let parseFailed = false;
  try {
    data = await res.json();
  } catch (parseErr) {
    parseFailed = true;
  }

  if (parseFailed) {
    // Backend down or proxy error page — try offline credential cache
    const offline = await tryOfflineFallback();
    if (offline) return offline;
    throw new Error("Server returned an invalid response. Is the backend running?");
  }

  if (!res.ok) {
    throw new Error(data.error || "Login failed");
  }

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(STAFF_KEY, JSON.stringify(data.staff));
  cacheCredential(pin, data.staff, data.token);
  return data;
}

export function getStoredStaff() {
  const raw = localStorage.getItem(STAFF_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(STAFF_KEY);
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (networkErr) {
    throw new Error("Server unreachable — working offline");
  }

  if (res.status === 401) {
    logout();
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    console.error("Non-JSON response", res.status, text.slice(0, 200));
    if (!res.ok) {
      // Our API always returns JSON errors, so a non-JSON error body means
      // the request never reached the backend (e.g. dev proxy error page
      // when the server is down/unreachable) — treat this as an offline
      // condition rather than surfacing a raw status code.
      throw new Error(
        "This feature needs an internet connection to the server. Please check your connection and try again.",
      );
    }
    throw new Error("Unexpected response from server. Is the backend running?");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ========== SALES API ==========

export async function createSale(customerId = null, paymentMethod = "cash") {
  return apiFetch("/sales", {
    method: "POST",
    body: JSON.stringify({
      customer_id: customerId,
      payment_method: paymentMethod,
    }),
  });
}

export async function getSale(saleId) {
  return apiFetch(`/sales/${saleId}`);
}

export async function updateSaleCustomer(saleId, customerId) {
  return apiFetch(`/sales/${saleId}/customer`, {
    method: "PATCH",
    body: JSON.stringify({ customer_id: customerId }),
  });
}

export async function addItemToSale(
  saleId,
  { productId, cylinderBrandId, quantity, unitPrice },
) {
  return apiFetch(`/sales/${saleId}/items`, {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      cylinder_brand_id: cylinderBrandId,
      quantity: parseFloat(quantity),
      unit_price: parseFloat(unitPrice),
    }),
  });
}

export async function removeItemFromSale(saleId, itemId) {
  return apiFetch(`/sales/${saleId}/items/${itemId}`, {
    method: "DELETE",
  });
}

export async function updateItemQuantity(saleId, itemId, quantity) {
  return apiFetch(`/sales/${saleId}/items/${itemId}/quantity`, {
    method: "PATCH",
    body: JSON.stringify({ quantity: parseFloat(quantity) }),
  });
}

export async function applyDiscount(saleId, amount, type = "fixed") {
  return apiFetch(`/sales/${saleId}/discount`, {
    method: "POST",
    body: JSON.stringify({ amount: parseFloat(amount), type }),
  });
}

export async function completeSale(saleId) {
  return apiFetch(`/sales/${saleId}/complete`, {
    method: "POST",
  });
}

export async function voidSale(saleId) {
  return apiFetch(`/sales/${saleId}/void`, {
    method: "POST",
  });
}

export async function getSaleReceipt(saleId) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/sales/${saleId}/receipt`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error("Failed to fetch receipt");
  return res.text();
}

export async function recordCylinderExchange(
  saleId,
  { emptyBrandId, issuedBrandId, priceAdjustment = 0 },
) {
  return apiFetch(`/sales/${saleId}/exchanges`, {
    method: "POST",
    body: JSON.stringify({
      empty_brand_id: emptyBrandId,
      issued_brand_id: issuedBrandId,
      price_adjustment: parseFloat(priceAdjustment),
    }),
  });
}

// ========== PAYMENTS API ==========

export async function processCashPayment(saleId, amountPaid) {
  return apiFetch("/payments/cash", {
    method: "POST",
    body: JSON.stringify({
      sale_id: saleId,
      amount_paid: parseFloat(amountPaid),
    }),
  });
}

export async function initiateM2pesa(phone, amount) {
  return apiFetch("/payments/mpesa/initiate", {
    method: "POST",
    body: JSON.stringify({
      phone,
      amount: parseFloat(amount),
    }),
  });
}

/**
 * Poll for the result of a pending STK push. Returns { pending: true }
 * while still awaiting the customer, or { pending: false, resultCode,
 * resultDesc } once resolved ("0" = success per Daraja docs).
 */
export async function getM2pesaStatus(mpesaTransactionId) {
  return apiFetch(`/payments/mpesa/status/${mpesaTransactionId}`);
}

export async function linkM2pesaToSale(mpesaTransactionId, saleId) {
  return apiFetch("/payments/mpesa/link", {
    method: "POST",
    body: JSON.stringify({
      mpesa_transaction_id: mpesaTransactionId,
      sale_id: saleId,
    }),
  });
}

/**
 * Complete a sale by charging it to a corporate account. If the sale would
 * exceed the account's credit limit, the backend responds 402 with
 * { requiresApproval: true, creditCheck } (surfaced on err.data) — call
 * verifyApprovalPin() to get a supervisor/admin staff id, then retry with
 * creditOverrideStaffId set.
 */
export async function completeAccountSale(saleId, corporateAccountId, creditOverrideStaffId = null) {
  return apiFetch("/payments/account", {
    method: "POST",
    body: JSON.stringify({
      sale_id: saleId,
      corporate_account_id: corporateAccountId,
      credit_override_staff_id: creditOverrideStaffId,
    }),
  });
}

/**
 * Confirm a PIN belongs to an active supervisor/admin, without switching
 * the logged-in cashier's session. Used for in-flow approvals (e.g.
 * credit-limit overrides). Returns { staff: { id, name, role } }.
 */
export async function verifyApprovalPin(pin) {
  return apiFetch("/auth/verify-approval", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}

// ========== CORPORATE ACCOUNTS API ==========

export async function listCorporateAccounts() {
  return apiFetch("/corporate/accounts");
}

export async function getCorporateAccount(corporateAccountId) {
  return apiFetch(`/corporate/accounts/${corporateAccountId}`);
}

export async function createCorporateAccount(customerId, creditLimit) {
  return apiFetch("/corporate/accounts", {
    method: "POST",
    body: JSON.stringify({ customer_id: customerId, credit_limit: parseFloat(creditLimit) }),
  });
}

export async function updateCorporateCreditLimit(corporateAccountId, creditLimit) {
  return apiFetch(`/corporate/accounts/${corporateAccountId}/credit-limit`, {
    method: "PATCH",
    body: JSON.stringify({ credit_limit: parseFloat(creditLimit) }),
  });
}

export async function checkCorporateCreditLimit(corporateAccountId, saleTotal) {
  return apiFetch(`/corporate/accounts/${corporateAccountId}/credit-check`, {
    method: "POST",
    body: JSON.stringify({ sale_total: parseFloat(saleTotal) }),
  });
}

export async function getCorporatePricing(corporateAccountId) {
  return apiFetch(`/corporate/accounts/${corporateAccountId}/pricing`);
}

export async function setCorporatePricing(corporateAccountId, productId, customPrice) {
  return apiFetch(`/corporate/accounts/${corporateAccountId}/pricing`, {
    method: "PUT",
    body: JSON.stringify({ product_id: productId, custom_price: parseFloat(customPrice) }),
  });
}

export async function removeCorporatePricing(corporateAccountId, productId) {
  return apiFetch(`/corporate/accounts/${corporateAccountId}/pricing/${productId}`, {
    method: "DELETE",
  });
}

export async function listCorporateInvoices(corporateAccountId) {
  return apiFetch(`/corporate/accounts/${corporateAccountId}/invoices`);
}

export async function generateTransactionInvoice(corporateAccountId, saleId) {
  return apiFetch(`/corporate/accounts/${corporateAccountId}/invoices/transaction`, {
    method: "POST",
    body: JSON.stringify({ sale_id: saleId }),
  });
}

export async function generateConsolidatedInvoice(corporateAccountId, coversUpTo) {
  return apiFetch(`/corporate/accounts/${corporateAccountId}/invoices/consolidated`, {
    method: "POST",
    body: JSON.stringify({ covers_up_to: coversUpTo }),
  });
}

export async function recordInvoicePayment(invoiceId, amount, method = "cash") {
  return apiFetch(`/corporate/invoices/${invoiceId}/payments`, {
    method: "POST",
    body: JSON.stringify({ amount: parseFloat(amount), method }),
  });
}

// ========== PRODUCTS API ==========

export async function getProducts(businessType = null) {
  const path = businessType
    ? `/products?business_type=${businessType}`
    : "/products";
  return apiFetch(path);
}

export async function getCylinderBrands() {
  return apiFetch("/products/cylinder-brands");
}

// ========== CUSTOMERS API ==========

export async function searchCustomers(query) {
  return apiFetch(`/customers/search?q=${encodeURIComponent(query)}`);
}

export async function getCustomer(customerId) {
  return apiFetch(`/customers/${customerId}`);
}

export async function getCustomerByPhone(phone) {
  return apiFetch(`/customers/phone/${phone}`);
}

export async function createCustomer(phone, name = "", { consentGiven, smsOptIn = true } = {}) {
  return apiFetch("/customers", {
    method: "POST",
    body: JSON.stringify({ phone, name, consent_given: consentGiven, sms_opt_in: smsOptIn }),
  });
}

export async function updateCustomer(customerId, updates) {
  return apiFetch(`/customers/${customerId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

/**
 * Grant/revoke a customer's data-retention consent and/or toggle their
 * promotional SMS opt-in. Granting consent on a voided record reactivates
 * it (see backend customers.service.js).
 */
export async function updateCustomerConsent(customerId, { consentGiven, smsOptIn } = {}) {
  return apiFetch(`/customers/${customerId}/consent`, {
    method: "PATCH",
    body: JSON.stringify({ consent_given: consentGiven, sms_opt_in: smsOptIn }),
  });
}

export async function runDpaRetentionCycle() {
  return apiFetch("/customers/dpa/run-retention-cycle", { method: "POST" });
}

// ========== LOYALTY API ==========

export async function getCustomerPoints(customerId) {
  return apiFetch(`/loyalty/customer/${customerId}/balance`);
}

export async function getLoyaltyConfig() {
  return apiFetch("/loyalty/config");
}

export async function updateLoyaltyConfig(config) {
  return apiFetch("/loyalty/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

// ========== REWARDS & PROMOTIONS API ==========
export async function getRewards(includeInactive = false) {
  return apiFetch(`/rewards${includeInactive ? "?include_inactive=true" : ""}`);
}
export async function createReward(reward) {
  return apiFetch("/rewards", { method: "POST", body: JSON.stringify(reward) });
}
export async function updateReward(rewardId, reward) {
  return apiFetch(`/rewards/${rewardId}`, { method: "PUT", body: JSON.stringify(reward) });
}
export async function redeemReward(rewardId, customerId) {
  return apiFetch(`/rewards/${rewardId}/redeem`, { method: "POST", body: JSON.stringify({ customer_id: customerId }) });
}
export async function getPromoRules(includeInactive = false) {
  return apiFetch(`/promotions/rules${includeInactive ? "?include_inactive=true" : ""}`);
}
export async function createPromoRule(rule) {
  return apiFetch("/promotions/rules", { method: "POST", body: JSON.stringify(rule) });
}
export async function updatePromoRule(ruleId, rule) {
  return apiFetch(`/promotions/rules/${ruleId}`, { method: "PUT", body: JSON.stringify(rule) });
}
export async function getPromoPayouts(includePaid = false) {
  return apiFetch(`/promotions/payouts${includePaid ? "?include_paid=true" : ""}`);
}
export async function markPromoPayoutPaid(payoutId) {
  return apiFetch(`/promotions/payouts/${payoutId}/paid`, { method: "PUT" });
}

// ========== STOCK ADMIN API ==========

export async function getCylinderStockAdmin() {
  return apiFetch("/stock-admin/cylinders");
}

export async function getLowStockAlerts() {
  return apiFetch("/stock-admin/cylinders/alerts");
}

export async function adjustCylinderStock(brandId, data) {
  return apiFetch(`/stock-admin/cylinders/${brandId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function updateStockThreshold(brandId, threshold) {
  return apiFetch(`/stock-admin/cylinders/${brandId}/threshold`, {
    method: "PUT",
    body: JSON.stringify({ threshold }),
  });
}

export async function getOversellFlags(includeResolved = false) {
  return apiFetch(`/stock-admin/oversells${includeResolved ? "?include_resolved=true" : ""}`);
}

export async function resolveOversellFlag(flagId) {
  return apiFetch(`/stock-admin/oversells/${flagId}/resolve`, {
    method: "PUT",
  });
}

export async function redeemPoints(customerId, saleId, points) {
  return apiFetch("/loyalty/redeem", {
    method: "POST",
    body: JSON.stringify({ customer_id: customerId, sale_id: saleId, points }),
  });
}

// ========== SYNC API ==========

export async function getSyncSnapshot(locationId) {
  return apiFetch(`/sync/snapshot?location_id=${locationId}`);
}

export async function uploadSyncSnapshot(snapshot) {
  return apiFetch("/sync/upload", {
    method: "POST",
    body: JSON.stringify(snapshot),
  });
}
