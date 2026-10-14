import apiClient from './apiClient';

export const CATALOG_CATEGORIES = ['Men', 'Women', 'Kids', 'Sunglasses'];

function toFiniteNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function normalizeProduct(product) {
  return {
    id: product.id,
    name: product.itemName,
    category: product.category,
    brand: product.brand,
    price: product.price,
    imageUrl: product.imageUrl || null,
  };
}

function buildProductQuery(filters = {}) {
  const params = new URLSearchParams();

  const search = String(filters.search || '').trim();
  const category = String(filters.category || '').trim();
  const brand = String(filters.brand || '').trim();
  const minPrice = toFiniteNumberOrNull(filters.minPrice);
  const maxPrice = toFiniteNumberOrNull(filters.maxPrice);

  if (search) {
    params.set('search', search);
  }

  if (category) {
    params.set('category', category);
  }

  if (brand) {
    params.set('brand', brand);
  }

  if (minPrice !== null && minPrice >= 0) {
    params.set('minPrice', String(minPrice));
  }

  if (maxPrice !== null && maxPrice >= 0) {
    params.set('maxPrice', String(maxPrice));
  }

  return params.toString();
}

export async function getProducts(filters = {}) {
  const query = buildProductQuery(filters);
  const path = query ? `/products?${query}` : '/products';

  const response = await apiClient.get(path, {
    authenticated: false,
  });

  if (!Array.isArray(response?.data)) {
    return [];
  }

  return response.data.map(normalizeProduct);
}

export function buildCatalogOptions(products = []) {
  const safeProducts = Array.isArray(products) ? products : [];

  const brands = uniqueSorted(
    safeProducts.map((product) => product.brand).filter(Boolean),
  );

  const prices = safeProducts
    .map((product) => product.price)
    .filter(Number.isFinite);

  return {
    categories: CATALOG_CATEGORIES,
    brands,
    minPrice: prices.length > 0 ? Math.min(...prices) : 0,
    maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
  };
}

export async function getProductById(id) {
  try {
    const response = await apiClient.get(
      `/products/${encodeURIComponent(id)}`,
      {
        authenticated: false,
      },
    );

    if (!response?.data) {
      return null;
    }

    return normalizeProduct(response.data);
  } catch (error) {
    if (error.status === 404) {
      return null;
    }

    throw error;
  }
}
