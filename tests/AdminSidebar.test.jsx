import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminSidebar from '../src/components/admin/AdminSidebar';
import AppLayout from '../src/layouts/AppLayout';
import useAuth from '../src/hooks/useAuth';
import useCart from '../src/hooks/useCart';

vi.mock('../src/hooks/useAuth');
vi.mock('../src/hooks/useCart');
vi.mock('../src/components/common/Footer', () => ({
  default: () => <footer>Customer footer</footer>,
}));
vi.mock('../src/components/chatbot/ChatbotWidget', () => ({
  default: () => <div>Customer chatbot</div>,
}));

function showAdminAt(path, role = 'SYSTEM_ADMIN') {
  useAuth.mockReturnValue({
    isAuthenticated: true,
    user: { role },
    logout: vi.fn(),
  });
  useCart.mockReturnValue({ cartCount: 0 });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/admin" element={<h1>Admin home</h1>} />
          <Route path="/admin/staff/new" element={<h1>Staff form</h1>} />
          <Route path="/admin/doctors/new" element={<h1>Doctor form</h1>} />
          <Route path="/" element={<h1>Customer home</h1>} />
        </Route>
        <Route path="/login" element={<h1>Login page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Admin Sidebar', () => {
  it.each([
    ['/admin', 'Dashboard'],
    ['/admin/staff/new', 'Add Staff Member'],
    ['/admin/doctors/new', 'Add Doctor'],
  ])('shows the current navigation item on %s', (path, activeLink) => {
    showAdminAt(path);
    expect(
      screen.getByRole('navigation', { name: 'Admin workspace' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: activeLink })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('link', { name: 'Add Staff Member' }),
    ).toHaveAttribute('href', '/admin/staff/new');
    expect(screen.getByRole('link', { name: 'Add Doctor' })).toHaveAttribute(
      'href',
      '/admin/doctors/new',
    );
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Men' })).not.toBeInTheDocument();
    expect(screen.queryByText('Customer footer')).not.toBeInTheDocument();
  });

  it('logs out from the sidebar without exposing storefront links', () => {
    const logout = vi.fn();
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: 'SYSTEM_ADMIN' },
      logout,
    });
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminSidebar />} />
          <Route path="/login" element={<h1>Login page</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Log Out' }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('heading', { name: 'Login page' }),
    ).toBeInTheDocument();
  });

  it('keeps the customer navigation and footer for non-admin users', () => {
    showAdminAt('/', 'CUSTOMER');
    expect(
      screen.queryByRole('navigation', { name: 'Admin workspace' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Men' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByText('Customer footer')).toBeInTheDocument();
  });
  it('uses the public storefront shell when SYSTEM_ADMIN visits a public route', () => {
    showAdminAt('/');
    expect(
      screen.queryByRole('navigation', { name: 'Admin workspace' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Men' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByText('Customer footer')).toBeInTheDocument();
  });
});
