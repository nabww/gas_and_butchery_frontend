import {
  addLocalSaleItem,
  updateLocalSaleItem,
  removeLocalSaleItem,
  setCurrentSaleCustomer,
  applyLocalDiscount,
  recordLocalPayment,
} from "./db/syncQueue";

export async function addSaleItem(saleId, saleLocalId, item) {
  const localResult = await addLocalSaleItem(saleLocalId, item);
  return localResult.record;
}

export async function updateSaleItem(localItemId, quantity, unitPrice) {
  const result = await updateLocalSaleItem(localItemId, quantity, unitPrice);
  return result.item;
}

export async function removeSaleItem(localItemId) {
  const item = await removeLocalSaleItem(localItemId);
  return item;
}

export async function setSaleCustomer(saleId, saleLocalId, customer) {
  await setCurrentSaleCustomer(saleLocalId, customer?.id || null);
}

export async function applySaleDiscount(saleId, saleLocalId, amount) {
  const sale = await applyLocalDiscount(saleLocalId, amount);
  return sale;
}

export async function recordCashSale(saleId, saleLocalId, amount) {
  const localResult = await recordLocalPayment(saleLocalId, {
    method: "cash",
    amount,
  });
  return localResult;
}

/**
 * Record a sale locally as paid via M-Pesa. Only call this once STK push
 * polling has confirmed success (resultCode "0") — marks the sale
 * completed (like cash), so it must never run before payment is confirmed
 * or stock/loyalty would be committed for a sale nobody actually paid for.
 */
export async function recordMpesaSale(saleId, saleLocalId, amount) {
  const localResult = await recordLocalPayment(saleLocalId, {
    method: "mpesa",
    amount,
  });
  return localResult;
}

/**
 * Record a sale locally as charged to a corporate account. Marks the sale
 * completed (like any other payment method) so the normal offline-sync
 * path picks it up, assigns a server id, and runs stock/loyalty/promo
 * side effects exactly once. The actual credit-limit check and corporate
 * ledger update happen server-side afterwards, once a real sale id exists
 * (see completeAccountSale in lib/api.js).
 */
export async function recordAccountSale(saleId, saleLocalId, amount) {
  const localResult = await recordLocalPayment(saleLocalId, {
    method: "account",
    amount,
  });
  return localResult;
}
