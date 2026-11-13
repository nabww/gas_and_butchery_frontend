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

// There is intentionally no recordAccountSale: account sales must go
// through syncAuthorizedAccountSale (syncQueue.js), which attaches the
// signed credit-check token the server requires before it will merge the
// sale or debit the corporate ledger. A locally-completed 'account' sale
// with no token is rejected on sync.
