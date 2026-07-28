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
