import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from '../src/components/products/ProductCard';
import useAuth from '../src/hooks/useAuth';
import useCart from '../src/hooks/useCart';

vi.mock('../src/hooks/useAuth');
vi.mock('../src/hooks/useCart');

const product = {
  id: 'test-frame',
  name: 'Test Frame',
  brand: 'Test Brand',
  category: 'Men',
  price: 12500,
  originalPrice: 14900,
  imageUrl: '/test-frame.jpg',
  imageAlt: 'Black rectangular test frame',
  frameType: 'Full Rim',
};

const backendProduct = {
  id: 'backend-frame',
  name: 'Backend Frame',
  brand: 'Backend Brand',
  category: 'Men',
  price: 10000,
};

function renderCard(productToRender = product) {
  return render(
    <MemoryRouter>
      <ProductCard product={productToRender} />
    </MemoryRouter>,
  );
}

describe('ProductCard', () => {
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

  it('renders core product information and meaningful alt text', () => {
    renderCard();

    expect(screen.getByText('Test Frame')).toBeInTheDocument();
    expect(screen.getByText('Test Brand')).toBeInTheDocument();
    expect(screen.getByText('Rs.12,500')).toBeInTheDocument();
    expect(screen.getByText('Men | Full Rim')).toBeInTheDocument();

    expect(
      screen.getByAltText('Black rectangular test frame'),
    ).toBeInTheDocument();
  });

  it('renders safely when only backend product fields are available', () => {
    renderCard(backendProduct);

    expect(screen.getByText('Backend Frame')).toBeInTheDocument();
    expect(screen.getByText('Backend Brand')).toBeInTheDocument();
    expect(screen.getByText('Rs.10,000')).toBeInTheDocument();
    expect(screen.getByText('Men')).toBeInTheDocument();

    expect(
      screen.getByRole('img', {
        name: 'Backend Frame image unavailable',
      }),
    ).toBeInTheDocument();

    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });

  it('uses one product-detail link for the entire card', () => {
    renderCard();

    const links = screen.getAllByRole('link');

    expect(links).toHaveLength(1);

    expect(
      screen.getByRole('link', { name: 'View Test Frame' }),
    ).toHaveAttribute('href', '/products/test-frame');
  });

  it('provides an Add to Cart action', () => {
    renderCard();

    expect(
      screen.getByRole('button', {
        name: 'Add Test Frame to cart',
      }),
    ).toBeInTheDocument();
  });

  it('provides separate keyboard controls for details and Add to Cart', async () => {
    const user = userEvent.setup();

    renderCard();

    await user.tab();

    expect(screen.getByRole('link', { name: 'View Test Frame' })).toHaveFocus();

    await user.tab();

    expect(
      screen.getByRole('button', {
        name: 'Add Test Frame to cart',
      }),
    ).toHaveFocus();
  });
});
