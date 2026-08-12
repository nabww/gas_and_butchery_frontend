import { getAll, putRecord } from "../db/indexedDb";
import { getProducts, getCylinderBrands } from "../api";

function normalizeList(response) {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.products)) return response.products;
  if (response && Array.isArray(response.brands)) return response.brands;
  return [];
}

export async function refreshProductCache(businessType = null, locationId) {
  try {
    const response = await getProducts(businessType, false, locationId);
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

export async function loadProducts(businessType = null, locationId) {
  console.log("loadProducts:", { businessType, locationId, online: navigator.onLine });
  if (navigator.onLine) {
    try {
      return await refreshProductCache(businessType, locationId);
    } catch (err) {
      console.warn("Falling back to cached products", err.message);
      return getCachedProducts(businessType);
    }
  }
  console.warn("Offline: loading cached products");
  return getCachedProducts(businessType);
}

export async function refreshCylinderBrandCache(locationId) {
  try {
    const response = await getCylinderBrands(false, locationId);
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

export async function loadCylinderBrands(locationId) {
  if (navigator.onLine) {
    try {
      return await refreshCylinderBrandCache(locationId);
    } catch (err) {
      return getCachedCylinderBrands();
    }
  }
  return getCachedCylinderBrands();
}
