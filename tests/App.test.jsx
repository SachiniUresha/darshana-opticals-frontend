import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OPTOMETRIST } from '../src/config/roles';
import App from '../src/App';
import AuthProvider from '../src/context/AuthProvider';
import useCart from '../src/hooks/useCart';
import ProtectedRoute from '../src/routes/ProtectedRoute';
import authService from '../src/services/auth/authService';
import profileService from '../src/services/profile/profileService';

vi.mock('../src/services/auth/authService', () => ({
  default: {
    getCurrentUser: vi.fn(() => null),
    isAuthenticated: vi.fn(() => false),
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    updateCurrentUser: vi.fn(),
  },
}));

vi.mock('../src/services/profile/profileService', () => ({
  default: {
    getProfile: vi.fn(async () => ({
      name: 'Jane Doe',
      email: 'jane@example.com',
      address: '',
      phone: '',
    })),
    updateProfile: vi.fn(),
  },
}));

vi.mock('../src/hooks/useCart');

function setAuthenticatedUser(user) {
  authService.getCurrentUser.mockReturnValue(user);
  authService.isAuthenticated.mockReturnValue(Boolean(user));
}

function renderAppAt(initialRoute, user = null) {
  setAuthenticatedUser(user);

  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function renderTestProtectedRoute(initialRoute, user, allowedRoles) {
  setAuthenticatedUser(user);

  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<h1>Safe home</h1>} />
          <Route path="/login" element={<h1>Login destination</h1>} />

          <Route
            element={
              <ProtectedRoute
                {...(allowedRoles !== undefined ? { allowedRoles } : {})}
              />
            }
          >
            <Route path="/clinical" element={<h1>Clinical test route</h1>} />
            <Route path="/protected" element={<h1>Protected test route</h1>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authService.getCurrentUser.mockReturnValue(null);
  authService.isAuthenticated.mockReturnValue(false);

  profileService.getProfile.mockClear();

  useCart.mockReturnValue({
    items: [],
    cartCount: 0,
    cartTotal: 0,
    hasUnavailableItems: false,
    isLoading: false,
    isMutating: false,
    error: '',
    canUseCart: false,
    addItem: vi.fn().mockResolvedValue(true),
    updateItemQuantity: vi.fn().mockResolvedValue(true),
    removeItem: vi.fn().mockResolvedValue(true),
    refreshCart: vi.fn().mockResolvedValue(true),
    clearError: vi.fn(),
  });
});

describe('Application shell', () => {
  it('renders the navbar, main content area, and footer', () => {
    renderAppAt('/');

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});

describe('Routing', () => {
  it('renders the HomePage on the "/" route', () => {
    renderAppAt('/');

    expect(
      screen.getByRole('heading', {
        name: /darshana opticals/i,
      }),
    ).toBeInTheDocument();
  });

  it('renders the NotFoundPage for an unknown route', () => {
    renderAppAt('/some/unknown/route');

    expect(
      screen.getByRole('heading', {
        name: /page not found/i,
      }),
    ).toBeInTheDocument();
  });

  it('renders the SignupPage on the "/signup" route', () => {
    renderAppAt('/signup');

    expect(
      screen.getByRole('heading', {
        name: /create account/i,
      }),
    ).toBeInTheDocument();
  });

  it('renders the LoginPage on the "/login" route', () => {
    renderAppAt('/login');

    expect(
      screen.getByRole('heading', {
        name: /welcome back/i,
      }),
    ).toBeInTheDocument();
  });

  it('allows Customer to access the profile page', async () => {
    renderAppAt('/profile', {
      id: 'customer-1',
      email: 'jane@example.com',
      role: 'CUSTOMER',
    });

    expect(
      await screen.findByRole('heading', {
        name: /personal information/i,
      }),
    ).toBeInTheDocument();

    expect(profileService.getProfile).toHaveBeenCalledTimes(1);
  });

  it('denies staff profile access before the profile API executes', async () => {
    renderAppAt('/profile', {
      id: 'optometrist-1',
      email: 'doctor@example.com',
      role: 'OPTOMETRIST',
    });

    expect(
      await screen.findByRole('heading', {
        name: /darshana opticals/i,
      }),
    ).toBeInTheDocument();

    expect(profileService.getProfile).not.toHaveBeenCalled();
  });

  it('allows Optometrist through an authenticated test-only Clinical route', () => {
    renderTestProtectedRoute(
      '/clinical',
      {
        id: 'optometrist-1',
        role: OPTOMETRIST,
      },
      [OPTOMETRIST],
    );

    expect(
      screen.getByRole('heading', {
        name: /clinical test route/i,
      }),
    ).toBeInTheDocument();
  });

  it('rejects Customer from the test-only Optometrist route', () => {
    renderTestProtectedRoute(
      '/clinical',
      {
        id: 'customer-1',
        role: 'CUSTOMER',
      },
      [OPTOMETRIST],
    );

    expect(
      screen.getByRole('heading', {
        name: /safe home/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', {
        name: /clinical test route/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('preserves authentication-only access through AuthProvider', () => {
    renderTestProtectedRoute('/protected', {
      id: 'manager-1',
      role: 'MANAGEMENT',
    });

    expect(
      screen.getByRole('heading', {
        name: /protected test route/i,
      }),
    ).toBeInTheDocument();
  });

  it('redirects an unauthenticated profile request to Login', () => {
    renderAppAt('/profile');

    expect(
      screen.getByRole('heading', {
        name: /welcome back/i,
      }),
    ).toBeInTheDocument();

    expect(profileService.getProfile).not.toHaveBeenCalled();
  });

  it('allows Customer to access the cart page', () => {
    renderAppAt('/cart', {
      id: 'customer-1',
      email: 'jane@example.com',
      role: 'CUSTOMER',
    });

    expect(
      screen.getByRole('heading', {
        name: 'Your cart is empty',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'Browse Products',
      }),
    ).toHaveAttribute('href', '/products');
  });

  it('redirects an unauthenticated cart request to Login', () => {
    renderAppAt('/cart');

    expect(
      screen.getByRole('heading', {
        name: /welcome back/i,
      }),
    ).toBeInTheDocument();
  });

  it('allows Customer to access the checkout entry page', () => {
    renderAppAt('/checkout', {
      id: 'customer-1',
      email: 'jane@example.com',
      role: 'CUSTOMER',
    });

    expect(
      screen.getByRole('heading', {
        name: 'Your cart is empty',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'Browse Products',
      }),
    ).toHaveAttribute('href', '/products');
  });

  it('redirects an unauthenticated checkout request to Login', () => {
    renderAppAt('/checkout');

    expect(
      screen.getByRole('heading', {
        name: /welcome back/i,
      }),
    ).toBeInTheDocument();
  });
});
