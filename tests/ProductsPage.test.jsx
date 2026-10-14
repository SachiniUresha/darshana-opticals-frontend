import useAuth from '../src/hooks/useAuth';
import useCart from '../src/hooks/useCart';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductDetailPage from '../src/pages/ProductDetailPage';
import ProductsPage from '../src/pages/ProductsPage';
import {
  buildCatalogOptions,
  getProductById,
  getProducts,
} from '../src/services/productService';

vi.mock('../src/services/productService', () => ({
  CATALOG_CATEGORIES: ['Men', 'Women', 'Kids', 'Sunglasses'],
  buildCatalogOptions: vi.fn(),
  getProducts: vi.fn(),
  getProductById: vi.fn(),
}));
vi.mock('../src/hooks/useAuth');
vi.mock('../src/hooks/useCart');

const testProducts = [
  {
    id: 'austen-classic',
    name: 'Austen Classic',
    brand: 'Oliver Peoples',
    category: 'Men',
    price: 12500,
    originalPrice: 14900,
    imageUrl: '/austen-classic.jpg',
    imageAlt: 'Black semi-rim rectangular optical frame',
    frameType: 'Semi-Rim',
    color: 'Black',
    description: 'A lightweight everyday optical frame.',
  },
  {
    id: 'meridian-slim',
    name: 'Meridian Slim',
    brand: 'Warby Parker',
    category: 'Women',
    price: 12290,
    originalPrice: 14500,
    imageUrl: '/meridian-slim.jpg',
    imageAlt: 'Rose coloured optical frame',
    frameType: 'Full Rim',
    color: 'Rose',
    description: 'A slim and lightweight optical frame.',
  },
  {
    id: 'cleo-cat-eye',
    name: 'Cleo Cat-Eye',
    brand: 'Oliver Peoples',
    category: 'Women',
    price: 18000,
    originalPrice: 20500,
    imageUrl: '/cleo-cat-eye.jpg',
    imageAlt: 'Gold cat-eye frame',
    frameType: 'Full Rim',
    color: 'Gold',
    description: 'An elegant cat-eye frame.',
  },
  {
    id: 'coastal-pilot',
    name: 'Coastal Pilot',
    brand: 'Ray-Ban',
    category: 'Sunglasses',
    price: 12290,
    originalPrice: 14500,
    imageUrl: '/coastal-pilot.jpg',
    imageAlt: 'Black pilot sunglasses',
    frameType: 'Full Rim',
    color: 'Black',
    description: 'Pilot-style sunglasses.',
  },
  {
    id: 'blue-shield',
    name: 'Blue Shield',
    brand: 'Oakley',
    category: 'Sunglasses',
    price: 18000,
    originalPrice: 20500,
    imageUrl: '/blue-shield.jpg',
    imageAlt: 'Blue mirrored sunglasses',
    frameType: 'Full Rim',
    color: 'Blue',
    description: 'Blue mirrored sports sunglasses.',
  },
];

function filterProducts(filters = {}) {
  const search = String(filters.search || '')
    .trim()
    .toLowerCase();

  return testProducts.filter((product) => {
    const matchesSearch =
      !search ||
      [product.name, product.brand].some((value) =>
        value.toLowerCase().includes(search),
      );

    const matchesCategory =
      !filters.category || product.category === filters.category;

    const matchesBrand = !filters.brand || product.brand === filters.brand;

    const matchesMinPrice =
      filters.minPrice === null ||
      filters.minPrice === undefined ||
      product.price >= filters.minPrice;

    const matchesMaxPrice =
      filters.maxPrice === null ||
      filters.maxPrice === undefined ||
      product.price <= filters.maxPrice;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesBrand &&
      matchesMinPrice &&
      matchesMaxPrice
    );
  });
}

function LocationProbe() {
  const location = useLocation();

  return (
    <output data-testid="location">
      {`${location.pathname}${location.search}`}
    </output>
  );
}

function renderCatalog(initialEntry = '/products') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />

      <Routes>
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        role: 'CUSTOMER',
      },
    });

    useCart.mockReturnValue({
      addItem: vi.fn().mockResolvedValue(true),
      isMutating: false,
    });

    buildCatalogOptions.mockImplementation((products = []) => {
      const brands = [...new Set(products.map((product) => product.brand))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      const prices = products
        .map((product) => product.price)
        .filter(Number.isFinite);

      return {
        categories: ['Men', 'Women', 'Kids', 'Sunglasses'],
        brands,
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      };
    });
    getProducts.mockImplementation(async (filters) => filterProducts(filters));

    getProductById.mockImplementation(async (id) => {
      return testProducts.find((product) => product.id === id) || null;
    });
  });

  it('shows the loading state and then the catalog', async () => {
    renderCatalog();

    expect(screen.getByText('Loading products...')).toBeInTheDocument();

    expect(await screen.findByText('Austen Classic')).toBeInTheDocument();
  });

  it('reuses the initial product response for catalog options without a duplicate request', async () => {
    renderCatalog();

    expect(await screen.findByText('Austen Classic')).toBeInTheDocument();

    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(getProducts).toHaveBeenCalledWith();

    expect(buildCatalogOptions).toHaveBeenCalledTimes(1);
    expect(buildCatalogOptions).toHaveBeenCalledWith(testProducts);
  });

  it('restores category state from a direct URL', async () => {
    renderCatalog('/products?category=Men');

    expect(screen.getByRole('heading', { name: 'Men' })).toBeInTheDocument();

    expect(document.title).toBe('Men | Darshana Opticals');

    expect(screen.getByRole('radio', { name: 'Men' })).toBeChecked();

    expect(await screen.findByText('Austen Classic')).toBeInTheDocument();

    expect(screen.queryByText('Meridian Slim')).not.toBeInTheDocument();
  });

  it('updates the URL when the category changes', async () => {
    const user = userEvent.setup();

    renderCatalog();

    await user.click(screen.getByRole('radio', { name: 'Women' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/products?category=Women',
      );
    });

    expect(document.title).toBe('Women | Darshana Opticals');

    expect(await screen.findByText('Meridian Slim')).toBeInTheDocument();
  });

  it('filters by a brand selected in the URL', async () => {
    renderCatalog('/products?brand=Oakley');

    expect(await screen.findByRole('radio', { name: 'Oakley' })).toBeChecked();

    expect(await screen.findByText('Blue Shield')).toBeInTheDocument();

    expect(screen.queryByText('Austen Classic')).not.toBeInTheDocument();
  });

  it('filters by maximum price', async () => {
    renderCatalog('/products?maxPrice=13000');

    expect(await screen.findByText('Austen Classic')).toBeInTheDocument();

    expect(screen.getByText('Meridian Slim')).toBeInTheDocument();

    expect(screen.queryByText('Blue Shield')).not.toBeInTheDocument();
  });

  it('commits the minimum price slider to the URL and filters products', async () => {
    renderCatalog();

    await screen.findByText('Austen Classic');

    const slider = screen.getByRole('slider', {
      name: /minimum price/i,
    });

    await waitFor(() => {
      expect(slider.value).toBe('12290');
    });

    fireEvent.change(slider, {
      target: { value: '15000' },
    });

    expect(screen.getByTestId('location')).not.toHaveTextContent('minPrice=');

    fireEvent.pointerUp(slider);

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/products?minPrice=15000',
      );
    });

    expect(await screen.findByText('Cleo Cat-Eye')).toBeInTheDocument();

    expect(screen.getByText('Blue Shield')).toBeInTheDocument();

    expect(screen.queryByText('Austen Classic')).not.toBeInTheDocument();

    expect(screen.queryByText('Meridian Slim')).not.toBeInTheDocument();
  });

  it('commits the price slider to the URL only after the interaction finishes', async () => {
    renderCatalog();

    await screen.findByText('Austen Classic');

    const slider = screen.getByRole('slider', {
      name: /maximum price/i,
    });

    fireEvent.change(slider, {
      target: { value: '13000' },
    });

    expect(screen.getByTestId('location')).toHaveTextContent('/products');

    expect(screen.getByTestId('location')).not.toHaveTextContent('maxPrice=');

    fireEvent.pointerUp(slider);

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/products?maxPrice=13000',
      );
    });
  });

  it('supports search from the query string', async () => {
    renderCatalog('/products?q=coastal');

    expect(await screen.findByText('Coastal Pilot')).toBeInTheDocument();

    expect(screen.queryByText('Austen Classic')).not.toBeInTheDocument();
  });

  it('clears the active search filter', async () => {
    const user = userEvent.setup();

    renderCatalog('/products?q=coastal');

    expect(await screen.findByText('Coastal Pilot')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Clear search',
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/products$/);
    });

    expect(await screen.findByText('Austen Classic')).toBeInTheDocument();
  });

  it('supports combined filters', async () => {
    renderCatalog('/products?category=Women&brand=Warby+Parker&maxPrice=13000');

    expect(await screen.findByText('Meridian Slim')).toBeInTheDocument();

    expect(screen.queryByText('Cleo Cat-Eye')).not.toBeInTheDocument();
  });

  it('clears all active filters', async () => {
    const user = userEvent.setup();

    renderCatalog('/products?category=Women&brand=Warby+Parker&maxPrice=13000');

    expect(await screen.findByText('Meridian Slim')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Clear all',
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/products$/);
    });

    expect(await screen.findByText('Austen Classic')).toBeInTheDocument();
  });

  it('resets both price filters without clearing other filters', async () => {
    const user = userEvent.setup();

    renderCatalog('/products?category=Women&minPrice=12000&maxPrice=19000');

    expect(await screen.findByText('Meridian Slim')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Reset price',
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/products?category=Women',
      );
    });

    expect(screen.getByTestId('location')).not.toHaveTextContent('minPrice=');

    expect(screen.getByTestId('location')).not.toHaveTextContent('maxPrice=');

    expect(screen.getByRole('radio', { name: 'Women' })).toBeChecked();

    expect(await screen.findByText('Cleo Cat-Eye')).toBeInTheDocument();
  });

  it('shows a no-results state', async () => {
    renderCatalog('/products?q=no-such-frame');

    expect(await screen.findByText('No products found')).toBeInTheDocument();
  });

  it('shows a friendly message when the product API fails', async () => {
    getProducts.mockRejectedValueOnce(
      new Error('Internal database connection failed.'),
    );

    renderCatalog();

    expect(
      await screen.findByText(
        'We could not load the catalog. Please try again.',
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByText('Internal database connection failed.'),
    ).not.toBeInTheDocument();
  });

  it('does not crash on invalid query values', async () => {
    renderCatalog('/products?category=Unknown&maxPrice=not-a-number');

    expect(
      screen.getByRole('heading', {
        name: 'Eyewear',
      }),
    ).toBeInTheDocument();

    expect(await screen.findByText('Austen Classic')).toBeInTheDocument();
  });

  it('navigates from a product card to product details', async () => {
    const user = userEvent.setup();

    renderCatalog('/products?category=Men');

    const link = await screen.findByRole('link', {
      name: 'View Austen Classic',
    });

    await user.click(link);

    expect(
      await screen.findByRole('heading', {
        name: 'Austen Classic',
      }),
    ).toBeInTheDocument();

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/products/austen-classic',
    );
  });
});
