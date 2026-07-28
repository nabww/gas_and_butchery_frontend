const OFFLINE_SALES_ENABLED_KEY = "tezipos-offline-sales-enabled";

export function isOfflineSalesEnabled() {
  const stored = localStorage.getItem(OFFLINE_SALES_ENABLED_KEY);
  return stored === null ? true : stored === "true";
}

export function setOfflineSalesEnabled(enabled) {
  localStorage.setItem(OFFLINE_SALES_ENABLED_KEY, String(enabled));
}
