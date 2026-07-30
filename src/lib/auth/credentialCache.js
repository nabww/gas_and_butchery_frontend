import { sha256Sync } from "./sha256";

const CACHE_KEY = "tezipos-credential-cache";

async function sha256(text) {
  if (crypto.subtle) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback for non-secure contexts (HTTP over LAN)
  return sha256Sync(text);
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export async function cacheCredential(pin, staff, token) {
  try {
    const pinHash = await sha256(pin);
    const cache = loadCache();
    cache[pinHash] = {
      staff,
      token,
      cachedAt: new Date().toISOString(),
    };
    saveCache(cache);
  } catch (err) {
    console.warn("Failed to cache credential:", err.message);
  }
}

export async function verifyOfflinePin(pin) {
  try {
    const pinHash = await sha256(pin);
    const cache = loadCache();
    const entry = cache[pinHash];
    if (!entry) return null;
    return { staff: entry.staff, token: entry.token, offline: true };
  } catch (err) {
    console.warn("Offline PIN verification failed:", err.message);
    return null;
  }
}
