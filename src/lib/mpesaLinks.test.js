import test from "node:test";
import assert from "node:assert/strict";
import {
  addPendingMpesaLink,
  listPendingMpesaLinks,
  removePendingMpesaLink,
  retryPendingMpesaLinks,
} from "./mpesaLinks.js";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const quiet = { warn() {} };

test("pending links are stored once per transaction and removable", () => {
  const storage = memoryStorage();
  addPendingMpesaLink({ mpesaTransactionId: 5, saleLocalId: "a" }, storage);
  addPendingMpesaLink({ mpesaTransactionId: 5, saleLocalId: "a" }, storage);
  addPendingMpesaLink({ mpesaTransactionId: 6, saleLocalId: "b" }, storage);
  assert.deepEqual(listPendingMpesaLinks(storage).map((e) => e.mpesaTransactionId), [5, 6]);
  removePendingMpesaLink(5, storage);
  assert.deepEqual(listPendingMpesaLinks(storage).map((e) => e.mpesaTransactionId), [6]);
});

test("unsynced sales wait; synced sales link and leave the queue", async () => {
  const storage = memoryStorage();
  addPendingMpesaLink({ mpesaTransactionId: 5, saleLocalId: "synced" }, storage);
  addPendingMpesaLink({ mpesaTransactionId: 6, saleLocalId: "unsynced" }, storage);
  const linkCalls = [];
  const result = await retryPendingMpesaLinks({
    storage,
    log: quiet,
    getSale: async (id) => (id === "synced" ? { server_id: 42 } : { server_id: null }),
    link: async (...args) => linkCalls.push(args),
  });
  assert.deepEqual(linkCalls, [[5, 42]]);
  assert.deepEqual(result, { linked: 1, dropped: 0, remaining: 1 });
  assert.deepEqual(listPendingMpesaLinks(storage).map((e) => e.mpesaTransactionId), [6]);
});

test("transient failures are kept for retry, permanent rejections are dropped", async () => {
  const storage = memoryStorage();
  for (const id of [1, 2, 3, 4, 5]) addPendingMpesaLink({ mpesaTransactionId: id, saleLocalId: `s${id}` }, storage);
  const statusFor = { 1: undefined, 2: 500, 3: 403, 4: 409, 5: 400 };
  const result = await retryPendingMpesaLinks({
    storage,
    log: quiet,
    getSale: async () => ({ server_id: 9 }),
    link: async (id) => {
      throw Object.assign(new Error("nope"), { status: statusFor[id] });
    },
  });
  assert.deepEqual(result, { linked: 0, dropped: 2, remaining: 3 });
  assert.deepEqual(listPendingMpesaLinks(storage).map((e) => e.mpesaTransactionId), [1, 2, 3]);
});

test("corrupt storage is treated as an empty queue", async () => {
  const storage = memoryStorage();
  storage.setItem("tezipos-pending-mpesa-links", "{not json");
  assert.deepEqual(listPendingMpesaLinks(storage), []);
  const result = await retryPendingMpesaLinks({ storage, log: quiet, getSale: async () => null, link: async () => {} });
  assert.deepEqual(result, { linked: 0, dropped: 0, remaining: 0 });
});
