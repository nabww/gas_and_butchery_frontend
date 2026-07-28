import { queueLocal, getByIndex, putRecord, deleteRecord } from "./indexedDb";
import { uploadSyncSnapshot } from "../api";

function nowIso() {
  return new Date().toISOString();
}

export async function queueCompletedSale(snapshot) {
  const record = {
    local_id: snapshot.sale.local_id,
    sale: snapshot.sale,
    items: snapshot.items || [],
    payments: snapshot.payments || [],
    customer: snapshot.customer || null,
    created_at: nowIso(),
  };
  await queueLocal("pending_sales", record);
  return record;
}

export async function getPendingSales() {
  return getByIndex("pending_sales", "sync_status", "pending");
}

export async function clearPendingSale(localId) {
  return deleteRecord("pending_sales", localId);
}

export async function pushPendingSales() {
  const pending = await getPendingSales();
  if (pending.length === 0) {
    return { pushed: 0, errors: 0 };
  }

  const snapshot = {
    locationId: pending[0].sale.location_id,
    records: {
      sales: pending.map((p) => p.sale),
      saleItems: pending.flatMap((p) =>
        (p.items || []).map((item) => ({
          ...item,
          sale_local_id: p.sale.local_id,
        })),
      ),
      cylinderExchanges: [],
      payments: pending.flatMap((p) =>
        (p.payments || []).map((payment) => ({
          ...payment,
          sale_local_id: p.sale.local_id,
        })),
      ),
      pointsLedger: [],
      rewardRedemptions: [],
      promoWins: [],
    },
  };

  const result = await uploadSyncSnapshot(snapshot);

  if (result && result.syncComplete) {
    for (const p of pending) {
      p.sync_status = "synced";
      p.synced_at = nowIso();
      await putRecord("pending_sales", p);
    }
  }

  return { pushed: pending.length, errors: result.errors || 0, result };
}
