import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AuthProvider from '../src/context/AuthProvider';
import SignupPage from '../src/pages/SignupPage';
import authService from '../src/services/auth/authService';

vi.mock('../src/services/auth/authService', () => ({
  default: {
    getCurrentUser: vi.fn(() => null),
    isAuthenticated: vi.fn(() => false),
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

function renderSignupPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SignupPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function fillValidFormExceptAgreement(user) {
  await user.type(screen.getByLabelText(/^first name$/i), 'Jane');
  await user.type(screen.getByLabelText(/^last name$/i), 'Doe');
  await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
  await user.type(screen.getByLabelText(/phone number/i), '0771234567');
  await user.type(
    screen.getByLabelText(/registered address/i),
    '  12 Main Street, Colombo  ',
  );
  await user.type(screen.getByLabelText(/^password$/i), 'Password123');
  await user.type(screen.getByLabelText(/confirm password/i), 'Password123');
}

describe('SignupPage', () => {
  beforeEach(() => {
    authService.getCurrentUser.mockReturnValue(null);
    authService.isAuthenticated.mockReturnValue(false);
    authService.register.mockReset();
    authService.register.mockResolvedValue({
      id: 'customer-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '0771234567',
      role: 'CUSTOMER',
    });
  });

  it('renders all required registration fields', () => {
    renderSignupPage();

    expect(screen.getByLabelText(/^first name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^last name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/registered address/i)).toBeRequired();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();

    expect(
      screen.getByRole('checkbox', {
        name: /i agree to the terms of service and privacy policy/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it('masks password and confirm password fields by default', () => {
    renderSignupPage();

    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
      'type',
      'password',
    );

    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute(
      'type',
      'password',
    );
  });

  it('shows validation errors and blocks submission when required fields are empty', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findAllByText(/this field is required/i),
    ).not.toHaveLength(0);

    expect(screen.getByLabelText(/^first name$/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );

    expect(screen.getByLabelText(/^last name$/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );

    expect(screen.getByLabelText(/registered address/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );

    expect(authService.register).not.toHaveBeenCalled();
  });

  it.each(['', '   '])(
    'rejects an empty or whitespace-only address (%j)',
    async (address) => {
      const user = userEvent.setup();
      renderSignupPage();

      await fillValidFormExceptAgreement(user);
      const addressField = screen.getByLabelText(/registered address/i);
      await user.clear(addressField);
      if (address) {
        await user.type(addressField, address);
      }
      await user.click(
        screen.getByRole('checkbox', {
          name: /i agree to the terms of service and privacy policy/i,
        }),
      );
      await user.click(screen.getByRole('button', { name: /create account/i }));

      expect(addressField).toHaveAttribute('aria-invalid', 'true');
      expect(authService.register).not.toHaveBeenCalled();
    },
  );

  it('rejects an invalid email format', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText(/enter a valid email address/i),
    ).toBeInTheDocument();

    expect(authService.register).not.toHaveBeenCalled();
  });

  it('detects a password confirmation mismatch', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    await user.type(screen.getByLabelText(/^first name$/i), 'Jane');
    await user.type(screen.getByLabelText(/^last name$/i), 'Doe');
    await user.type(
      screen.getByLabelText(/email address/i),
      'jane@example.com',
    );
    await user.type(screen.getByLabelText(/phone number/i), '0771234567');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(
      screen.getByLabelText(/confirm password/i),
      'DifferentPass1',
    );

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText(/passwords do not match/i),
    ).toBeInTheDocument();

    expect(authService.register).not.toHaveBeenCalled();
  });

  it('requires the Terms of Service / Privacy Policy agreement before submitting', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    await fillValidFormExceptAgreement(user);

    await user.click(screen.getByRole('button', { name: /create account/i }));

    const agreementError = await screen.findByText(
      /you must agree to the terms of service and privacy policy/i,
    );

    expect(agreementError).toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox', {
      name: /i agree to the terms of service and privacy policy/i,
    });

    expect(checkbox).toHaveAttribute('aria-invalid', 'true');

    expect(checkbox).toHaveAccessibleDescription(
      /you must agree to the terms of service and privacy policy/i,
    );

    expect(authService.register).not.toHaveBeenCalled();
  });

  it('renders the Terms of Service and Privacy Policy as link-styled controls', () => {
    renderSignupPage();

    expect(
      screen.getByRole('link', { name: /^terms of service$/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /^privacy policy$/i }),
    ).toBeInTheDocument();
  });

  it('submits valid registration data and displays the success response', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    await fillValidFormExceptAgreement(user);

    await user.click(
      screen.getByRole('checkbox', {
        name: /i agree to the terms of service and privacy policy/i,
      }),
    );

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '0771234567',
        address: '12 Main Street, Colombo',
        password: 'Password123',
      });
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      /account created successfully/i,
    );

    expect(screen.getByLabelText(/^password$/i)).toHaveValue('');
    expect(screen.getByLabelText(/confirm password/i)).toHaveValue('');
  });

  it('displays a backend registration error and keeps the page usable', async () => {
    authService.register.mockRejectedValueOnce(
      new Error('An account with this email already exists.'),
    );

    const user = userEvent.setup();
    renderSignupPage();

    await fillValidFormExceptAgreement(user);

    await user.click(
      screen.getByRole('checkbox', {
        name: /i agree to the terms of service and privacy policy/i,
      }),
    );

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText(/an account with this email already exists/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeEnabled();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('disables repeated signup submissions while registration is loading', async () => {
    let resolveRegistration;

    authService.register.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRegistration = resolve;
        }),
    );

    const user = userEvent.setup();
    renderSignupPage();

    await fillValidFormExceptAgreement(user);

    await user.click(
      screen.getByRole('checkbox', {
        name: /i agree to the terms of service and privacy policy/i,
      }),
    );

    await user.click(screen.getByRole('button', { name: /create account/i }));

    const loadingButton = screen.getByRole('button', {
      name: /creating account/i,
    });

    expect(loadingButton).toBeDisabled();
    expect(authService.register).toHaveBeenCalledTimes(1);

    await user.click(loadingButton);

    expect(authService.register).toHaveBeenCalledTimes(1);

    resolveRegistration({
      id: 'customer-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '0771234567',
      role: 'CUSTOMER',
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      /account created successfully/i,
    );
  });
});
