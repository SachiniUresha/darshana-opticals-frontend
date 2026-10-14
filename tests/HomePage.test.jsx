import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '../src/pages/HomePage';
import { getProducts } from '../src/services/productService';
import useAuth from '../src/hooks/useAuth';
import useCart from '../src/hooks/useCart';

vi.mock('../src/hooks/useAuth');
vi.mock('../src/hooks/useCart');
vi.mock('../src/services/productService', () => ({
  CATALOG_CATEGORIES: ['Men', 'Women', 'Kids', 'Sunglasses'],
  getProducts: vi.fn(),
}));

const exampleProducts = Array.from({ length: 8 }, (_, index) => ({
  id: `frame-${index + 1}`,
  name: `Frame ${index + 1}`,
  brand: 'Example Brand',
  category: 'Men',
  price: 12000 + index * 100,
}));

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe('DDP-077 HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
    });

    useCart.mockReturnValue({
      addItem: vi.fn().mockResolvedValue(true),
      isLoading: false,
      isMutating: false,
    });

    getProducts.mockResolvedValue([]);
  });

  it('replaces the placeholder with hero, highlights and promotional sections', async () => {
    renderHome();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Find Your Perfect Vision/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'Shop Collections' }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'Featured Frames' }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'Discover Sunglasses' }),
    ).toBeInTheDocument();

    expect(screen.getByText('Explore collections')).toBeInTheDocument();

    expect(
      screen.queryByText(/This is the base application shell/),
    ).not.toBeInTheDocument();

    expect(
      await screen.findByText(/No products available right now/),
    ).toBeInTheDocument();
  });

  // Test A: Wait for asynchronous product loading to finish.
  it('provides a real catalogue destination for the primary CTA', async () => {
    renderHome();

    expect(screen.getByRole('link', { name: /Shop Now/i })).toHaveAttribute(
      'href',
      '/products',
    );

    expect(
      screen.getByRole('link', { name: /Explore Styles/i }),
    ).toHaveAttribute('href', '#home-collections');

    await screen.findByText(/No products available right now/);
  });

  // Test B: Wait for product loading after checking category navigation.
  it.each(['Men', 'Women', 'Kids', 'Sunglasses'])(
    'sends the %s card to the existing catalogue filter',
    async (category) => {
      renderHome();

      expect(
        screen.getByRole('link', { name: `Shop ${category} collection` }),
      ).toHaveAttribute('href', `/products?category=${category}`);

      await screen.findByText(/No products available right now/);
    },
  );

  // Test C: Wait for asynchronous updates after verifying the Kids image.
  it('displays the supplied Kids photo instead of the graphic fallback', async () => {
    renderHome();

    const kidsCard = screen.getByRole('link', {
      name: 'Shop Kids collection',
    });

    expect(kidsCard.querySelector('img')).toBeInTheDocument();

    expect(
      kidsCard.querySelector('.home-collections__kids-graphic'),
    ).toBeNull();

    await screen.findByText(/No products available right now/);
  });

  it('shows a loading state before the live service returns', () => {
    getProducts.mockReturnValue(new Promise(() => {}));

    renderHome();

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading featured products...',
    );
  });

  it('previews at most six live products using existing ProductCard links', async () => {
    getProducts.mockResolvedValue(exampleProducts);

    renderHome();

    expect(await screen.findByText('Frame 1')).toBeInTheDocument();
    expect(screen.getByText('Frame 6')).toBeInTheDocument();
    expect(screen.queryByText('Frame 7')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'View Frame 1' })).toHaveAttribute(
      'href',
      '/products/frame-1',
    );

    expect(getProducts).toHaveBeenCalledWith();
    expect(getProducts).toHaveBeenCalledTimes(1);
  });

  it('keeps navigation usable if the catalogue is empty', async () => {
    renderHome();

    expect(
      await screen.findByText(/No products available right now/),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: 'Shop Kids collection' }),
    ).toHaveAttribute('href', '/products?category=Kids');
  });

  it('handles API failure safely and retries without exposing raw error', async () => {
    getProducts.mockRejectedValueOnce(new Error('PRIVATE BACKEND ERROR'));
    getProducts.mockResolvedValueOnce([exampleProducts[0]]);

    renderHome();

    expect(
      await screen.findByText(/We could not load featured products/),
    ).toBeInTheDocument();

    expect(screen.queryByText('PRIVATE BACKEND ERROR')).not.toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: 'Shop Men collection' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() =>
      expect(screen.getByText('Frame 1')).toBeInTheDocument(),
    );

    expect(getProducts).toHaveBeenCalledTimes(2);
  });

  it('does not provide unimplemented appointment, cart or discount actions', async () => {
    renderHome();

    expect(
      screen.queryByRole('link', { name: /book appointment/i }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('link', { name: /claim offer/i }),
    ).not.toBeInTheDocument();

    expect(
      await screen.findByText(/No products available right now/),
    ).toBeInTheDocument();
  });
});
