import { getAll, putRecord } from "../db/indexedDb";
import { getProducts, getCylinderBrands } from "../api";

function normalizeList(response) {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.products)) return response.products;
  if (response && Array.isArray(response.brands)) return response.brands;
  return [];
}

export async function refreshProductCache(businessType = null) {
  try {
    const response = await getProducts(businessType);
    const products = normalizeList(response);
    for (const product of products) {
      await putRecord("products", {
        ...product,
        local_id: String(product.id),
        _cached_at: Date.now(),
      });
    }
    return products;
  } catch (err) {
    throw err;
  }
}

export async function getCachedProducts(businessType = null) {
  const all = (await getAll("products")) || [];
  if (businessType) {
    return all.filter((p) => p.business_type === businessType);
  }
  return all;
}

export async function loadProducts(businessType = null) {
  console.log("loadProducts:", { businessType, online: navigator.onLine });
  if (navigator.onLine) {
    try {
      return await refreshProductCache(businessType);
    } catch (err) {
      console.warn("Falling back to cached products", err.message);
      return getCachedProducts(businessType);
    }
  }
  console.warn("Offline: loading cached products");
  return getCachedProducts(businessType);
}

export async function refreshCylinderBrandCache() {
  try {
    const response = await getCylinderBrands();
    const brands = normalizeList(response);
    for (const brand of brands) {
      await putRecord("cylinder_brands", {
        ...brand,
        local_id: String(brand.id),
        _cached_at: Date.now(),
      });
    }
    return brands;
  } catch (err) {
    throw err;
  }
}

export async function getCachedCylinderBrands() {
  return (await getAll("cylinder_brands")) || [];
}

export async function loadCylinderBrands() {
  if (navigator.onLine) {
    try {
      return await refreshCylinderBrandCache();
    } catch (err) {
      return getCachedCylinderBrands();
    }
  }
  return getCachedCylinderBrands();
}
