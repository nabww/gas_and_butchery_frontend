import { queueLocal, putRecord, getById, getByIndex, deleteRecord } from "./indexedDb";
import { uploadSyncSnapshot, getSaleReceipt } from "../api";

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function getOrCreateLocalSale(staff) {
  return getById("sales", localStorage.getItem("tezipos-current-sale-id"));
}

export async function createLocalSale(staff) {
  const localId = generateId();
  const sale = {
    local_id: localId,
    server_id: null,
    location_id: staff?.locationId || 1,
    staff_id: staff?.id || 1,
    customer_id: null,
    subtotal: 0,
    discount_amount: 0,
    total: 0,
    payment_method: "cash",
    status: "pending",
    sync_status: "pending",
    created_at: nowIso(),
  };
  await queueLocal("sales", sale);
  localStorage.setItem("tezipos-current-sale-id", localId);
  return sale;
}

export async function loadCurrentSale(staff) {
  const currentId = localStorage.getItem("tezipos-current-sale-id");
  if (currentId) {
    const sale = await getById("sales", currentId);
    if (sale && sale.status !== "completed") {
      return sale;
    }
  }
  return createLocalSale(staff);
}

export async function resetCurrentSale(staff) {
  const currentId = localStorage.getItem("tezipos-current-sale-id");
  if (currentId) {
    const sale = await getById("sales", currentId);
    if (sale) {
      sale.status = "completed";
      sale.sync_status = sale.server_id ? "synced" : "pending";
      await putRecord("sales", sale);
    }
  }
  return createLocalSale(staff);
}

export async function setCurrentSaleCustomer(localSaleId, customerId) {
  const sale = await getById("sales", localSaleId);
  if (!sale) return null;
  sale.customer_id = customerId;
  await putRecord("sales", sale);
  return sale;
}

export async function addLocalSaleItem(localSaleId, item) {
  const localId = generateId();
  const record = {
    local_id: localId,
    sale_local_id: localSaleId,
    product_id: item.product_id || null,
    cylinder_brand_id: item.cylinder_brand_id || null,
    product_name: item.product_name || "Item",
    pricing_type: item.pricing_type || "fixed",
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    sync_status: "pending",
    created_at: nowIso(),
  };
  await queueLocal("sale_items", record);

  const sale = await getById("sales", localSaleId);
  if (sale) {
    sale.subtotal = parseFloat((sale.subtotal + item.line_total).toFixed(2));
    sale.total = Math.max(0, sale.subtotal - sale.discount_amount);
    await putRecord("sales", sale);
  }
  return { record, sale };
}

export async function updateLocalSaleItem(localItemId, quantity, unitPrice) {
  const item = await getById("sale_items", localItemId);
  if (!item) return null;

  const oldLineTotal = item.line_total;
  item.quantity = quantity;
  item.line_total = parseFloat((quantity * unitPrice).toFixed(2));
  await putRecord("sale_items", item);

  const sale = await getById("sales", item.sale_local_id);
  if (sale) {
    sale.subtotal = parseFloat((sale.subtotal - oldLineTotal + item.line_total).toFixed(2));
    sale.total = Math.max(0, sale.subtotal - sale.discount_amount);
    await putRecord("sales", sale);
  }
  return { item, sale };
}

export async function removeLocalSaleItem(localItemId) {
  const item = await getById("sale_items", localItemId);
  if (!item) return null;
  await deleteRecord("sale_items", localItemId);

  const sale = await getById("sales", item.sale_local_id);
  if (sale) {
    sale.subtotal = parseFloat((sale.subtotal - item.line_total).toFixed(2));
    sale.total = Math.max(0, sale.subtotal - sale.discount_amount);
    await putRecord("sales", sale);
  }
  return sale;
}

export async function applyLocalDiscount(localSaleId, discountAmount) {
  const sale = await getById("sales", localSaleId);
  if (!sale) return null;
  sale.discount_amount = Math.min(discountAmount, sale.subtotal);
  sale.total = Math.max(0, sale.subtotal - sale.discount_amount);
  sale.sync_status = "pending";
  await putRecord("sales", sale);
  return sale;
}

export async function redeemLocalPoints(localSaleId, customerId, points, kesValue) {
  const sale = await getById("sales", localSaleId);
  if (!sale) return null;

  const newDiscount = parseFloat(sale.discount_amount || 0) + kesValue;
  sale.discount_amount = Math.min(newDiscount, sale.subtotal);
  sale.total = Math.max(0, sale.subtotal - sale.discount_amount);
  sale.sync_status = "pending";
  await putRecord("sales", sale);

  const localId = generateId();
  const ledgerEntry = {
    local_id: localId,
    customer_id: customerId,
    sale_local_id: localSaleId,
    type: "redeem",
    points,
    balance_after: null,
    sync_status: "pending",
    created_at: nowIso(),
  };
  await queueLocal("points_ledger", ledgerEntry);

  return { sale, ledgerEntry };
}

export async function recordLocalCylinderExchange(localSaleId, exchange) {
  const localId = generateId();
  const record = {
    local_id: localId,
    sale_local_id: localSaleId,
    empty_brand_id: exchange.empty_brand_id,
    issued_brand_id: exchange.issued_brand_id,
    price_adjustment: exchange.price_adjustment || 0,
    sync_status: "pending",
    created_at: nowIso(),
  };
  await queueLocal("cylinder_exchanges", record);
  return record;
}

export async function recordLocalPayment(localSaleId, payment) {
  const sale = await getById("sales", localSaleId);
  if (!sale) return null;

  const localId = generateId();
  const paymentRecord = {
    local_id: localId,
    sale_local_id: localSaleId,
    method: payment.method,
    amount: payment.amount,
    status: "completed",
    sync_status: "pending",
    created_at: nowIso(),
  };
  await queueLocal("payments", paymentRecord);

  sale.payment_method = payment.method;
  sale.status = "completed";
  sale.sync_status = "pending";
  await putRecord("sales", sale);
  return { sale, paymentRecord };
}

export async function getPendingSaleSnapshot(localSaleId) {
  const sale = await getById("sales", localSaleId);
  if (!sale) return null;
  const items = await getByIndex("sale_items", "sale_local_id", localSaleId);
  const payments = await getByIndex("payments", "sale_local_id", localSaleId);
  const exchanges = await getByIndex("cylinder_exchanges", "sale_local_id", localSaleId);
  let pointsLedger = [];
  try {
    pointsLedger = await getByIndex("points_ledger", "sale_local_id", localSaleId);
  } catch (e) {
    // Index may not exist on older DB versions
  }
  return {
    ...sale,
    items,
    payments,
    exchanges,
    pointsLedger,
  };
}

export async function getAllPendingSnapshots() {
  const sales = await getByIndex("sales", "sync_status", "pending");
  const completed = sales.filter((s) => s.status === "completed");
  return Promise.all(completed.map((s) => getPendingSaleSnapshot(s.local_id)));
}

let syncInProgress = false;

export async function syncPendingSales() {
  if (syncInProgress) {
    return { syncComplete: true, synced: 0, errors: 0, conflicts: 0, skipped: true };
  }
  syncInProgress = true;
  try {
    return await doSyncPendingSales();
  } finally {
    syncInProgress = false;
  }
}

async function doSyncPendingSales() {
  const pending = await getAllPendingSnapshots();
  if (pending.length === 0) {
    return { syncComplete: true, synced: 0, errors: 0, conflicts: 0 };
  }

  const saleLocalIdToServerId = {};
  const snapshot = {
    locationId: pending[0]?.location_id || 1,
    records: {
      sales: pending.map((s) => ({
        local_id: s.local_id,
        staff_id: s.staff_id,
        customer_id: s.customer_id,
        subtotal: s.subtotal,
        discount_amount: s.discount_amount,
        total: s.total,
        payment_method: s.payment_method,
        status: s.status,
      })),
      saleItems: pending.flatMap((s) =>
        s.items.map((i) => ({
          local_id: i.local_id,
          sale_local_id: s.local_id,
          product_id: i.product_id,
          cylinder_brand_id: i.cylinder_brand_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          line_total: i.line_total,
        })),
      ),
      cylinderExchanges: pending.flatMap((s) =>
        s.exchanges.map((e) => ({
          local_id: e.local_id,
          sale_local_id: s.local_id,
          empty_brand_id: e.empty_brand_id,
          issued_brand_id: e.issued_brand_id,
          price_adjustment: e.price_adjustment,
        })),
      ),
      payments: pending.flatMap((s) =>
        s.payments.map((p) => ({
          local_id: p.local_id,
          sale_local_id: s.local_id,
          method: p.method,
          amount: p.amount,
          status: p.status,
        })),
      ),
      pointsLedger: pending.flatMap((s) =>
        (s.pointsLedger || []).map((pl) => ({
          local_id: pl.local_id,
          customer_id: pl.customer_id,
          sale_local_id: s.local_id,
          type: pl.type,
          points: pl.points,
          balance_after: pl.balance_after,
        })),
      ),
      rewardRedemptions: [],
      promoWins: [],
    },
  };

  const result = await uploadSyncSnapshot(snapshot);

  if (result && result.saleServerIds) {
    Object.assign(saleLocalIdToServerId, result.saleServerIds);
  }

  for (const sale of pending) {
    const serverId = saleLocalIdToServerId[sale.local_id];
    if (serverId || (result && !result.errors)) {
      sale.server_id = serverId || sale.server_id;
      sale.sync_status = serverId ? "synced" : "pending";
      await putRecord("sales", sale);
      for (const item of sale.items) {
        item.sync_status = serverId ? "synced" : "pending";
        await putRecord("sale_items", item);
      }
      for (const pmt of sale.payments) {
        pmt.sync_status = serverId ? "synced" : "pending";
        await putRecord("payments", pmt);
      }
    }
  }

  return result;
}

export async function fetchReceiptForLocalSale(localSaleId) {
  const sale = await getById("sales", localSaleId);
  if (!sale || !sale.server_id) {
    throw new Error("Sale has not been synced to the server yet");
  }
  return getSaleReceipt(sale.server_id);
}

export function watchOnline(callback) {
  const handler = () => callback(navigator.onLine);
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}
