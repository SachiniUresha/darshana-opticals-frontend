import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthProvider from '../src/context/AuthProvider';
import LoginPage from '../src/pages/LoginPage';
import authService from '../src/services/auth/authService';
import { getPostLoginRoute } from '../src/routes/roleNavigation';

vi.mock('../src/routes/roleNavigation', () => ({
  getPostLoginRoute: vi.fn(() => '/'),
}));

vi.mock('../src/services/auth/authService', () => ({
  default: {
    getCurrentUser: vi.fn(() => null),
    isAuthenticated: vi.fn(() => false),
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/forgot-password"
            element={<p>Forgot password page test marker</p>}
          />
          <Route path="/" element={<p>Home page test marker</p>} />
          <Route path="/clinical" element={<p>Clinical test marker</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function fillValidLoginForm(user) {
  await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');

  await user.type(screen.getByLabelText(/^password$/i), 'Password123');
}

describe('LoginPage', () => {
  beforeEach(() => {
    authService.getCurrentUser.mockReturnValue(null);
    authService.isAuthenticated.mockReturnValue(false);

    authService.login.mockReset();
    getPostLoginRoute.mockReset();
    getPostLoginRoute.mockReturnValue('/');

    authService.login.mockResolvedValue({
      id: 'customer-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'CUSTOMER',
    });
  });

  it('renders email and password fields', () => {
    renderLoginPage();

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it('does not render the removed Remember me for 30 days option', () => {
    renderLoginPage();

    expect(
      screen.queryByText(/remember me for 30 days/i),
    ).not.toBeInTheDocument();
  });

  it('masks the password field by default', () => {
    renderLoginPage();

    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
      'type',
      'password',
    );
  });

  it('navigates from Login to the public Forgot Password route', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const link = screen.getByRole('link', { name: /forgot password\?/i });
    expect(link).toHaveAttribute('href', '/forgot-password');
    await user.click(link);

    expect(
      await screen.findByText('Forgot password page test marker'),
    ).toBeInTheDocument();
  });

  it('shows validation errors and blocks login when required fields are empty', async () => {
    const user = userEvent.setup();

    renderLoginPage();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findAllByText(/this field is required/i),
    ).not.toHaveLength(0);

    expect(screen.getByLabelText(/email address/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );

    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );

    expect(authService.login).not.toHaveBeenCalled();
  });

  it('rejects an invalid email format', async () => {
    const user = userEvent.setup();

    renderLoginPage();

    await user.type(screen.getByLabelText(/email address/i), 'invalid-email');

    await user.type(screen.getByLabelText(/^password$/i), 'Password123');

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText(/enter a valid email address/i),
    ).toBeInTheDocument();

    expect(authService.login).not.toHaveBeenCalled();
  });

  it('submits valid credentials and establishes login successfully', async () => {
    const user = userEvent.setup();

    renderLoginPage();

    await fillValidLoginForm(user);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: 'jane@example.com',
        password: 'Password123',
      });
    });

    expect(
      await screen.findByText(/home page test marker/i),
    ).toBeInTheDocument();
  });

  it('routes by the backend-returned role, not a misleading email address', async () => {
    authService.login.mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Dr. Jane Doe',
      email: 'customer@example.com',
      role: 'OPTOMETRIST',
    });
    getPostLoginRoute.mockImplementation((role) =>
      role === 'OPTOMETRIST' ? '/clinical' : '/',
    );

    const user = userEvent.setup();

    renderLoginPage();
    await fillValidLoginForm(user);
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText(/clinical test marker/i),
    ).toBeInTheDocument();
    expect(getPostLoginRoute).toHaveBeenCalledWith('OPTOMETRIST');
  });

  it('shows a backend login error and does not establish a session', async () => {
    authService.login.mockRejectedValueOnce(
      new Error('Invalid email or password.'),
    );

    const user = userEvent.setup();

    renderLoginPage();

    await fillValidLoginForm(user);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText(/invalid email or password/i),
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('prevents repeated login submissions while authentication is loading', async () => {
    let resolveLogin;

    authService.login.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );

    const user = userEvent.setup();

    renderLoginPage();

    await fillValidLoginForm(user);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const loadingButton = screen.getByRole('button', {
      name: /signing in/i,
    });

    expect(loadingButton).toBeDisabled();
    expect(authService.login).toHaveBeenCalledTimes(1);

    await user.click(loadingButton);

    expect(authService.login).toHaveBeenCalledTimes(1);

    resolveLogin({
      id: 'customer-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'CUSTOMER',
    });

    expect(
      await screen.findByText(/home page test marker/i),
    ).toBeInTheDocument();
  });
});
