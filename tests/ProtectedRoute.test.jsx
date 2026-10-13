import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../src/routes/ProtectedRoute';
import useAuth from '../src/hooks/useAuth';
import {
  CUSTOMER,
  OPTOMETRIST,
  SYSTEM_ADMIN,
  BRANCH_MANAGER,
  BRANCH_ASSISTANT,
} from '../src/config/roles';

vi.mock('../src/hooks/useAuth');

function renderProtectedRoute({
  initialRoute = '/protected',
  allowedRoles,
  nested = false,
} = {}) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/login" element={<h1>Login page</h1>} />
        <Route path="/" element={<h1>Safe home</h1>} />

        <Route
          element={
            <ProtectedRoute
              {...(allowedRoles !== undefined ? { allowedRoles } : {})}
            />
          }
        >
          {nested ? (
            <Route
              element={
                <section>
                  <Outlet />
                </section>
              }
            >
              <Route path="/protected" element={<h1>Protected content</h1>} />
            </Route>
          ) : (
            <Route path="/protected" element={<h1>Protected content</h1>} />
          )}
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  it('redirects an unauthenticated user to the login page', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, user: null });

    renderProtectedRoute();

    expect(
      screen.getByRole('heading', { name: /login page/i }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', { name: /protected content/i }),
    ).not.toBeInTheDocument();
  });

  it('allows an authenticated user to access protected content', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: CUSTOMER },
    });

    renderProtectedRoute();

    expect(
      screen.getByRole('heading', { name: /protected content/i }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', { name: /login page/i }),
    ).not.toBeInTheDocument();
  });

  it('allows an authenticated user without a role restriction', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: 'UNRECOGNIZED_ROLE' },
    });

    renderProtectedRoute();

    expect(
      screen.getByRole('heading', { name: /protected content/i }),
    ).toBeInTheDocument();
  });

  it('allows a user matching one of several canonical roles through a nested outlet', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: OPTOMETRIST },
    });

    renderProtectedRoute({
      allowedRoles: [CUSTOMER, OPTOMETRIST],
      nested: true,
    });

    expect(
      screen.getByRole('heading', { name: /protected content/i }),
    ).toBeInTheDocument();
  });

  it.each([
    ['wrong role', { role: SYSTEM_ADMIN }],
    ['missing role', {}],
    ['unknown role', { role: 'ADMIN' }],
    ['case-mismatched role', { role: 'optometrist' }],
    ['missing user', null],
  ])('denies an authenticated user with a %s', (_description, user) => {
    useAuth.mockReturnValue({ isAuthenticated: true, user });

    renderProtectedRoute({ allowedRoles: [CUSTOMER] });

    expect(
      screen.getByRole('heading', { name: /safe home/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /protected content/i }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['empty array', []],
    ['null', null],
    ['string', 'CUSTOMER'],
    ['object', {}],
    ['array with an unknown role', [CUSTOMER, 'ADMIN']],
    ['sparse array', new Array(1)],
  ])(
    'denies access for a malformed allowedRoles %s',
    (_description, allowedRoles) => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        user: { role: CUSTOMER },
      });

      renderProtectedRoute({ allowedRoles });

      expect(
        screen.getByRole('heading', { name: /safe home/i }),
      ).toBeInTheDocument();
    },
  );

  it.each(['INVENTORY_MANAGER', 'MANAGEMENT', 'SALES_ASSISTANT_CASHIER'])(
    'denies retired role %s',
    (role) => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        user: { role },
      });

      renderProtectedRoute({
        allowedRoles: [BRANCH_MANAGER, BRANCH_ASSISTANT],
      });

      expect(
        screen.getByRole('heading', { name: /safe home/i }),
      ).toBeInTheDocument();

      expect(
        screen.queryByRole('heading', { name: /protected content/i }),
      ).not.toBeInTheDocument();
    },
  );

  it.each([BRANCH_MANAGER, BRANCH_ASSISTANT])(
    'allows authorized role %s through a multi-role route',
    (role) => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        user: { role },
      });

      renderProtectedRoute({
        allowedRoles: [BRANCH_MANAGER, BRANCH_ASSISTANT],
      });

      expect(
        screen.getByRole('heading', { name: /protected content/i }),
      ).toBeInTheDocument();
    },
  );
});
