import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ForgotPasswordPage from '../src/pages/ForgotPasswordPage';
import authService from '../src/services/auth/authService';

vi.mock('../src/services/auth/authService', () => ({
  default: { requestPasswordReset: vi.fn() },
}));

function showPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<p>Login screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function submitEmail(email = 'user@example.com') {
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an email-only recovery form and a login link', () => {
    showPage();
    expect(screen.getByLabelText(/email address/i)).toBeRequired();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(
      screen.queryByLabelText(/password|account type|role|branch/i),
    ).toBeNull();
    expect(
      screen.getByRole('link', { name: /back to log in/i }),
    ).toHaveAttribute('href', '/login');
  });

  it('validates required email before making an API call', () => {
    showPage();
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/required/i);
    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('validates email format before making an API call', () => {
    showPage();
    submitEmail('invalid-email');
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('submits through the shared service and always displays generic confirmation', async () => {
    authService.requestPasswordReset.mockResolvedValueOnce({
      success: true,
      message: 'Sensitive backend response that should never be displayed',
    });
    showPage();
    submitEmail('  USER@example.com  ');

    expect(authService.requestPasswordReset).toHaveBeenCalledWith(
      'USER@example.com',
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      /if an eligible account exists/i,
    );
    expect(screen.queryByText(/sensitive backend response/i)).toBeNull();
    expect(screen.queryByLabelText(/email address/i)).toBeNull();
  });

  it('prevents repeated requests while the first one is pending', async () => {
    let finish;
    authService.requestPasswordReset.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    showPage();
    submitEmail();
    expect(authService.requestPasswordReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Sending...' }));
    expect(authService.requestPasswordReset).toHaveBeenCalledTimes(1);
    finish({ success: true });
    expect(await screen.findByRole('status')).toHaveTextContent(
      /if an eligible account exists/i,
    );
  });

  it.each([
    [422, /valid email address/i],
    [429, /too many requests/i],
    [0, /unable to reach the server/i],
    [500, /unable to process your request/i],
  ])('handles status %s with a safe message', async (status, message) => {
    authService.requestPasswordReset.mockRejectedValueOnce(
      Object.assign(new Error('Sensitive backend details'), { status }),
    );
    showPage();
    submitEmail();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText(/sensitive backend details/i)).toBeNull();
    expect(
      screen.getByRole('button', { name: /send reset link/i }),
    ).toBeEnabled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('supports returning to the existing login route', async () => {
    const user = userEvent.setup();
    showPage();
    await user.click(screen.getByRole('link', { name: /back to log in/i }));
    await waitFor(() =>
      expect(screen.getByText('Login screen')).toBeInTheDocument(),
    );
  });
});

// DDP-081 privacy regression: even differing backend wording never leaks identity.
describe('DDP-081 privacy regression', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['registered@example.com', 'Sensitive: registered account'],
    ['unknown@example.com', 'Sensitive: account missing'],
  ])(
    'shows identical generic confirmation for %s',
    async (email, backendMessage) => {
      authService.requestPasswordReset.mockResolvedValueOnce({
        success: true,
        message: backendMessage,
      });
      showPage();
      submitEmail(email);
      expect(
        await screen.findByText(
          /if an eligible account exists for this email/i,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(backendMessage)).not.toBeInTheDocument();
    },
  );
});
