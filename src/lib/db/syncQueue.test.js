import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./syncQueue.js", import.meta.url), "utf8");
const checkoutSource = source.slice(
  source.indexOf("export async function syncAuthorizedAccountSale"),
  source.indexOf("async function doSyncPendingSales"),
).replace("export async function", "async function");

function checkoutHarness(response) {
  const writes = [];
  const events = [];
  let uploaded;
  const draft = {
    local_id: "draft-1", location_id: 3, total: 500, status: "pending",
    items: [{ local_id: "item-1" }], payments: [],
    exchanges: [{ local_id: "exchange-1" }], pointsLedger: [{ local_id: "points-1" }],
  };
  const deps = {
    getPendingSaleSnapshot: async () => draft,
    nowIso: () => "2026-11-04T00:00:00Z",
    buildSnapshotForGroup: (locationId, sales) => ({ locationId, records: { sales } }),
    uploadSyncSnapshot: async (snapshot) => {
      uploaded = snapshot;
      if (response instanceof Error) throw response;
      return response;
    },
    putRecord: async (table, record) => writes.push({ table, record }),
    window: { dispatchEvent: (event) => events.push(event) },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  };
  const checkout = new Function(...Object.keys(deps), `${checkoutSource}; return syncAuthorizedAccountSale;`)(...Object.values(deps));
  return { checkout, writes, events, draft, uploaded: () => uploaded };
}

test("missing authorization fails closed before uploading or persisting checkout", async () => {
  const harness = checkoutHarness({});
  await assert.rejects(harness.checkout("draft-1"), /not authorized/);
  assert.equal(harness.uploaded(), undefined);
  assert.deepEqual(harness.writes, []);
});

test("unapproved account checkout leaves draft and every local child unchanged", async () => {
  const harness = checkoutHarness({ accountErrors: { "draft-1": {
    error: "Approval required", requiresApproval: true, creditCheck: { availableCredit: 100 },
  } } });
  await assert.rejects(harness.checkout("draft-1", "authorization"), (error) => error.data.requiresApproval);
  assert.deepEqual(harness.writes, []);
  assert.deepEqual(harness.events, []);
  assert.equal(harness.draft.status, "pending");
});

test("uncertain network outcome does not enqueue a completed account sale", async () => {
  const harness = checkoutHarness(new Error("Connection lost"));
  await assert.rejects(harness.checkout("draft-1", "authorization"), /Connection lost/);
  assert.deepEqual(harness.writes, []);
  assert.equal(harness.draft.status, "pending");
});

test("background redemption recovery cannot upload an unfinished account draft", async () => {
  const syncSource = source.slice(source.indexOf("async function doSyncPendingSales()"), source.indexOf("export async function fetchReceiptForLocalSale"));
  let uploads = 0;
  const deps = {
    getAllPendingSnapshots: async () => [],
    getByIndex: async () => [{ sale_local_id: "draft-1" }],
    getPendingSaleSnapshot: async () => ({ local_id: "draft-1", status: "pending" }),
    uploadSyncSnapshot: async () => { uploads += 1; },
  };
  const sync = new Function(...Object.keys(deps), `${syncSource}; return doSyncPendingSales;`)(...Object.values(deps));
  const result = await sync();
  assert.equal(uploads, 0);
  assert.equal(result.synced, 0);
});

test("accepted account checkout persists completion only after server acknowledgement", async () => {
  const harness = checkoutHarness({ saleServerIds: { "draft-1": 42 }, errors: 0, conflicts: 0 });
  const result = await harness.checkout("draft-1", "authorization");
  assert.equal(result.serverSaleId, 42);
  const sale = harness.uploaded().records.sales[0];
  assert.equal(sale.account_authorization, "authorization");
  assert.equal(sale.payments[0].local_id, "draft-1:account");
  assert.equal(sale.status, "completed");
  assert.equal(harness.writes[0].record.server_id, 42);
  assert.ok(harness.writes.every(({ record }) => record.sync_status === "synced"));
  assert.deepEqual(harness.events[0].detail.saleServerIds, { "draft-1": 42 });
});
