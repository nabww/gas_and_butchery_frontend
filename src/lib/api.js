const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV
    ? "/api"
    : `${window.location.protocol}//${window.location.hostname}:4000/api`);
const TOKEN_KEY = "tezipos-token";
const STAFF_KEY = "tezipos-staff";

export async function login(pin) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Login failed");
  }

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(STAFF_KEY, JSON.stringify(data.staff));
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
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    logout();
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    console.error("Non-JSON response", res.status, text.slice(0, 200));
    throw new Error(
      res.ok
        ? "Unexpected response from server. Is the backend running?"
        : `Request failed (${res.status})`,
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
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

export async function linkM2pesaToSale(
  mpesaTransactionId,
  saleId,
  resultCode = "0",
) {
  return apiFetch("/payments/mpesa/link", {
    method: "POST",
    body: JSON.stringify({
      mpesa_transaction_id: mpesaTransactionId,
      sale_id: saleId,
      result_code: resultCode,
    }),
  });
}

export async function processAccountPayment(corporateAccountId, amount) {
  return apiFetch("/payments/account", {
    method: "POST",
    body: JSON.stringify({
      corporate_account_id: corporateAccountId,
      amount: parseFloat(amount),
    }),
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

export async function createCustomer(phone, name = "") {
  return apiFetch("/customers", {
    method: "POST",
    body: JSON.stringify({ phone, name }),
  });
}

// ========== LOYALTY API ==========

export async function getCustomerPoints(customerId) {
  return apiFetch(`/loyalty/customer/${customerId}/balance`);
}

export async function getLoyaltyConfig() {
  return apiFetch("/loyalty/config");
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
