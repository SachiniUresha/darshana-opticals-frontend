import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ResetPasswordPage from '../src/pages/ResetPasswordPage';
import authService from '../src/services/auth/authService';

vi.mock('../src/services/auth/authService', () => ({
  default: { resetPassword: vi.fn() },
}));

function CurrentLocation() {
  const location = useLocation();
  return (
    <output data-testid="reset-url">
      {location.pathname + location.search}
    </output>
  );
}

function showPage(url = '/reset-password?token=test-reset-token') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/forgot-password"
          element={<p>Forgot Password destination</p>}
        />
        <Route path="/login" element={<p>Login destination</p>} />
      </Routes>
      <CurrentLocation />
    </MemoryRouter>,
  );
}

function fillPasswords(password = 'NewPassword123', confirmation = password) {
  fireEvent.change(screen.getByLabelText(/^new password$/i), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
    target: { value: confirmation },
  });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /^reset password$/i }));
}

describe('ResetPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows only two masked password fields and compatible password guidance', () => {
    showPage();
    expect(screen.getByLabelText(/^new password$/i)).toHaveAttribute(
      'type',
      'password',
    );
    expect(screen.getByLabelText(/^confirm password$/i)).toHaveAttribute(
      'type',
      'password',
    );
    expect(screen.getAllByLabelText(/password/i)).toHaveLength(2);
    expect(screen.queryByLabelText(/email|role|account type/i)).toBeNull();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('shows a safe recovery path when the token is missing', () => {
    showPage('/reset-password');
    expect(screen.getByRole('alert')).toHaveTextContent(/invalid or expired/i);
    expect(screen.queryByLabelText(/^new password$/i)).toBeNull();
    expect(
      screen.getByRole('link', { name: /request a new reset link/i }),
    ).toHaveAttribute('href', '/forgot-password');
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('blocks a password mismatch without calling the backend', () => {
    showPage();
    fillPasswords('NewPassword123', 'DifferentPassword123');
    submit();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /passwords must match/i,
    );
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it.each([
    ['short1A', 'NewPassword123'],
    ['alllowercase123', 'alllowercase123'],
    ['ALLUPPERCASE123', 'ALLUPPERCASE123'],
    ['NoNumbersHere', 'NoNumbersHere'],
  ])(
    'blocks passwords that do not meet the backend policy',
    (password, confirm) => {
      showPage();
      fillPasswords(password, confirm);
      submit();
      expect(
        screen.getByText(/at least 8 characters with an uppercase/i),
      ).toBeInTheDocument();
      expect(authService.resetPassword).not.toHaveBeenCalled();
    },
  );

  it('sends only token and newPassword and clears the token-bearing URL after success', async () => {
    authService.resetPassword.mockResolvedValueOnce({ success: true });
    showPage();
    fillPasswords();
    submit();
    expect(authService.resetPassword).toHaveBeenCalledWith({
      token: 'test-reset-token',
      newPassword: 'NewPassword123',
    });
    expect(
      await screen.findByText(/your password has been reset successfully/i),
    ).toHaveTextContent(/successfully/i);
    expect(screen.queryByLabelText(/^new password$/i)).toBeNull();
    expect(screen.getByTestId('reset-url')).toHaveTextContent(
      '/reset-password',
    );
    expect(screen.getByTestId('reset-url')).not.toHaveTextContent(
      'test-reset-token',
    );
    expect(
      screen
        .getByRole('link', { name: /back to log in/i })
        .getAttribute('href'),
    ).toBe('/login');
  });

  it('prevents a duplicate request while the first reset is pending', async () => {
    let finish;
    authService.resetPassword.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    showPage();
    fillPasswords();
    submit();
    expect(screen.getByRole('button', { name: 'Resetting...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Resetting...' }));
    expect(authService.resetPassword).toHaveBeenCalledTimes(1);
    await act(async () => finish({ success: true }));
    expect(
      await screen.findByText(/your password has been reset successfully/i),
    ).toHaveTextContent(/successfully/i);
  });

  it('handles expired or already-used tokens without revealing account details', async () => {
    authService.resetPassword.mockRejectedValueOnce(
      Object.assign(new Error('Sensitive backend error'), {
        status: 400,
        code: 'RESET_TOKEN_INVALID_OR_EXPIRED',
      }),
    );
    showPage();
    fillPasswords();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /invalid or expired/i,
    );
    expect(screen.queryByText(/sensitive backend error/i)).toBeNull();
    expect(
      screen.getByRole('link', { name: /request a new reset link/i }),
    ).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByTestId('reset-url')).not.toHaveTextContent(
      'test-reset-token',
    );
  });

  it.each([
    [422, /password that meets the stated requirements/i],
    [429, /too many requests/i],
    [0, /unable to reach the server/i],
    [500, /unable to reset your password/i],
  ])(
    'handles status %s without leaking internal errors',
    async (status, message) => {
      authService.resetPassword.mockRejectedValueOnce(
        Object.assign(new Error('Sensitive backend message'), { status }),
      );
      showPage();
      fillPasswords();
      submit();
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.queryByText(/sensitive backend message/i)).toBeNull();
      expect(
        screen.getByRole('button', { name: /^reset password$/i }),
      ).toBeEnabled();
    },
  );

  it('does not save tokens or passwords to browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    authService.resetPassword.mockResolvedValueOnce({ success: true });
    try {
      showPage();
      fillPasswords();
      submit();
      expect(
        await screen.findByText(/your password has been reset successfully/i),
      ).toBeInTheDocument();
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });
});
