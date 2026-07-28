import { getAll, putRecord } from "../db/indexedDb";
import { searchCustomers } from "../api";

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
  return all.filter(
    (c) =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)),
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
