// Confirmed M-Pesa payments whose sale hasn't been linked server-side yet.
// The customer has already paid by the time an entry lands here, so a sync
// or network failure after payment must never lose the link (points, promo
// wins, payer registration and reconciliation all hang off it).
const KEY = "tezipos-pending-mpesa-links";

// 400/404/409 mean the server inspected the link and rejected it for good
// (amount/shop mismatch, already linked elsewhere). Anything else -- offline,
// 5xx, 401/403 from a different staff login -- is retried later.
const PERMANENT_STATUSES = new Set([400, 404, 409]);

function read(storage) {
  try {
    const entries = JSON.parse(storage.getItem(KEY) || "[]");
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function write(storage, entries) {
  if (entries.length) storage.setItem(KEY, JSON.stringify(entries));
  else storage.removeItem(KEY);
}

export function addPendingMpesaLink({ mpesaTransactionId, saleLocalId }, storage = localStorage) {
  const entries = read(storage).filter((e) => e.mpesaTransactionId !== mpesaTransactionId);
  entries.push({ mpesaTransactionId, saleLocalId, createdAt: new Date().toISOString() });
  write(storage, entries);
}

export function removePendingMpesaLink(mpesaTransactionId, storage = localStorage) {
  write(storage, read(storage).filter((e) => e.mpesaTransactionId !== mpesaTransactionId));
}

export function listPendingMpesaLinks(storage = localStorage) {
  return read(storage);
}

let running = false;

export async function retryPendingMpesaLinks({ getSale, link, storage = localStorage, log = console }) {
  if (running) return { linked: 0, dropped: 0, remaining: read(storage).length };
  running = true;
  let linked = 0;
  let dropped = 0;
  try {
    for (const entry of read(storage)) {
      const sale = await getSale(entry.saleLocalId).catch(() => null);
      if (!sale?.server_id) continue;
      try {
        await link(entry.mpesaTransactionId, sale.server_id);
        removePendingMpesaLink(entry.mpesaTransactionId, storage);
        linked += 1;
      } catch (err) {
        if (PERMANENT_STATUSES.has(err.status)) {
          log.warn?.(`M-Pesa payment ${entry.mpesaTransactionId} could not be linked to sale ${sale.server_id}: ${err.message}`);
          removePendingMpesaLink(entry.mpesaTransactionId, storage);
          dropped += 1;
        }
      }
    }
  } finally {
    running = false;
  }
  return { linked, dropped, remaining: read(storage).length };
}
