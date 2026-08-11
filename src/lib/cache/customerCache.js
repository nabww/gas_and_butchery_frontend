import { getAll, putRecord } from "../db/indexedDb";
import { searchCustomers } from "../api";

function phoneMatchCandidates(phone) {
  const digits = String(phone).replace(/[^\d]/g, "");
  if (!digits) return [];
  let canonical = digits;
  if (canonical.startsWith("0")) {
    canonical = `254${canonical.slice(1)}`;
  } else if (canonical.startsWith("7") || canonical.startsWith("1")) {
    canonical = `254${canonical}`;
  }
  const local = `0${canonical.slice(3)}`;
  const plus = `+${canonical}`;
  return [...new Set([canonical, local, plus])];
}

function toCachedCustomer(customer) {
  return {
    ...customer,
    local_id: customer.local_id || String(customer.id),
    _cached_at: Date.now(),
  };
}

export async function refreshCustomerCache(query = "") {
  try {
    const results = await searchCustomers(query || " ");
    if (!Array.isArray(results)) return [];
    for (const customer of results) {
      await putRecord("customers", toCachedCustomer(customer));
    }
    return results;
  } catch (err) {
    throw err;
  }
}

export async function getCachedCustomers() {
  return (await getAll("customers")) || [];
}

export async function searchCachedCustomers(query) {
  const all = await getCachedCustomers();
  const q = query.toLowerCase();
  const phoneQueries = phoneMatchCandidates(query).map((p) => p.toLowerCase());
  return all.filter(
    (c) =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && phoneQueries.some((p) => c.phone.toLowerCase().includes(p))) ||
      (c.alt_phone && phoneQueries.some((p) => c.alt_phone.toLowerCase().includes(p))),
  );
}

export async function searchCustomersWithFallback(query) {
  if (navigator.onLine) {
    try {
      const results = await searchCustomers(query);
      for (const customer of results) {
        await putRecord("customers", toCachedCustomer(customer));
      }
      return results;
    } catch (err) {
      return searchCachedCustomers(query);
    }
  }
  return searchCachedCustomers(query);
}

export async function addCustomerToCache(customer) {
  await putRecord("customers", toCachedCustomer(customer));
}
