import useAuth from '../src/hooks/useAuth';
import useCart from '../src/hooks/useCart';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductDetailPage from '../src/pages/ProductDetailPage';
import { getProductById } from '../src/services/productService';

vi.mock('../src/services/productService', () => ({
  getProductById: vi.fn(),
}));
vi.mock('../src/hooks/useAuth');
vi.mock('../src/hooks/useCart');

const testProduct = {
  id: 'austen-classic',
  name: 'Austen Classic',
  brand: 'Oliver Peoples',
  category: 'Men',
  price: 12500,
  originalPrice: 14900,
  imageUrl: '/austen-classic.jpg',
  imageAlt: 'Black semi-rim rectangular optical frame on a white background',
  frameType: 'Semi-Rim',
  color: 'Black',
  description:
    'A lightweight everyday optical frame with a clean rectangular profile and comfortable nose pads.',
};

function renderDetail(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/products/:id" element={<ProductDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductDetailPage', () => {
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
  });

  it('renders the selected product details without duplicated description text', async () => {
    getProductById.mockResolvedValueOnce(testProduct);

    renderDetail('/products/austen-classic');

    expect(
      await screen.findByRole('heading', {
        name: 'Austen Classic',
      }),
    ).toBeInTheDocument();

    expect(getProductById).toHaveBeenCalledWith('austen-classic');

    expect(screen.getAllByText('Oliver Peoples')).toHaveLength(2);

    expect(screen.getByText('Rs.12,500')).toBeInTheDocument();

    expect(
      screen.getByAltText(
        'Black semi-rim rectangular optical frame on a white background',
      ),
    ).toBeInTheDocument();

    expect(
      screen.getAllByText(
        'A lightweight everyday optical frame with a clean rectangular profile and comfortable nose pads.',
      ),
    ).toHaveLength(1);

    expect(
      screen.getByRole('link', {
        name: 'Back to products',
      }),
    ).toHaveAttribute('href', '/products');

    await waitFor(() => {
      expect(document.title).toBe('Austen Classic | Darshana Opticals');
    });
  });

  it('renders safely when only backend product fields are available', async () => {
    getProductById.mockResolvedValueOnce({
      id: 'backend-frame',
      name: 'Backend Frame',
      brand: 'Backend Brand',
      category: 'Men',
      price: 10000,
    });

    renderDetail('/products/backend-frame');

    expect(
      await screen.findByRole('heading', {
        name: 'Backend Frame',
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByText('Backend Brand')).toHaveLength(2);
    expect(screen.getAllByText('Men')).toHaveLength(2);
    expect(screen.getByText('Rs.10,000')).toBeInTheDocument();

    expect(
      screen.getByRole('img', {
        name: 'Backend Frame image unavailable',
      }),
    ).toBeInTheDocument();

    expect(screen.queryByText('Frame type')).not.toBeInTheDocument();
    expect(screen.queryByText('Colour')).not.toBeInTheDocument();
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });

  it('handles an unknown product id', async () => {
    getProductById.mockResolvedValueOnce(null);

    renderDetail('/products/not-real');

    expect(
      await screen.findByRole('heading', {
        name: 'Product not found',
      }),
    ).toBeInTheDocument();

    expect(getProductById).toHaveBeenCalledWith('not-real');

    expect(
      screen.getByRole('link', {
        name: 'Back to products',
      }),
    ).toHaveAttribute('href', '/products');

    await waitFor(() => {
      expect(document.title).toBe('Product Not Found | Darshana Opticals');
    });
  });

  it('shows a user-friendly message when the product API fails', async () => {
    getProductById.mockRejectedValueOnce(
      new Error('Internal database connection failed.'),
    );

    renderDetail('/products/product-1');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load this product. Please try again.',
    );

    expect(
      screen.queryByText('Internal database connection failed.'),
    ).not.toBeInTheDocument();
  });
});
