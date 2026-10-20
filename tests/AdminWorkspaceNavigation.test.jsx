import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../src/components/common/Navbar';
import AppLayout from '../src/layouts/AppLayout';
import { Route, Routes } from 'react-router-dom';
import useAuth from '../src/hooks/useAuth';
import useCart from '../src/hooks/useCart';

vi.mock('../src/hooks/useAuth');
vi.mock('../src/hooks/useCart');
vi.mock('../src/components/common/Footer', () => ({
  default: () => <div data-testid="customer-footer">Footer</div>,
}));
vi.mock('../src/components/chatbot/ChatbotWidget', () => ({
  default: () => <div data-testid="customer-chatbot">Chatbot</div>,
}));

function showNavbar(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar />
    </MemoryRouter>,
  );
}

function showLayout(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<h1>Customer home</h1>} />
          <Route path="/admin" element={<h1>Admin workspace</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Admin workspace navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCart.mockReturnValue({ cartCount: 0 });
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: 'SYSTEM_ADMIN' },
      logout: vi.fn(),
    });
  });

  it.each([
    '/admin',
    '/admin/staff',
    '/admin/staff/new',
    '/admin/doctors',
    '/admin/doctors/new',
  ])('hides storefront navigation on %s', (path) => {
    showNavbar(path);
    expect(
      screen.getByRole('link', { name: 'Admin Dashboard' }),
    ).toHaveAttribute('href', '/admin');
    expect(
      screen.getByRole('link', {
        name: /darshana opticals admin dashboard/i,
      }),
    ).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('button', { name: 'Log Out' })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Men' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Women' }),
    ).not.toBeInTheDocument();
  });

  it('hides the storefront footer and chatbot for SYSTEM_ADMIN', () => {
    showLayout('/admin');
    expect(
      screen.getByRole('heading', { name: 'Admin workspace' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('customer-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('customer-chatbot')).not.toBeInTheDocument();
  });

  it('keeps storefront navigation and footer for CUSTOMER', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: 'CUSTOMER' },
      logout: vi.fn(),
    });
    showLayout('/');
    expect(screen.getByRole('link', { name: 'Men' })).toHaveAttribute(
      'href',
      '/products?category=Men',
    );
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByTestId('customer-footer')).toBeInTheDocument();
    expect(screen.getByTestId('customer-chatbot')).toBeInTheDocument();
  });
  it.each(['/', '/products'])(
    'keeps the storefront Navbar for SYSTEM_ADMIN on the public route %s',
    (path) => {
      showNavbar(path);
      expect(screen.getByRole('link', { name: 'Men' })).toBeInTheDocument();
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
    },
  );
});
