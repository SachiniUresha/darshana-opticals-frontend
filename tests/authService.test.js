import apiClient from '../src/services/apiClient';
import authService from '../src/services/auth/authService';
import authStorage from '../src/services/auth/authStorage';

vi.mock('../src/services/apiClient', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('../src/services/auth/authStorage', () => ({
  default: {
    saveAuth: vi.fn(),
    getToken: vi.fn(),
    getUser: vi.fn(),
    clearAuth: vi.fn(),
  },
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the correct public registration request to the backend', async () => {
    apiClient.post.mockResolvedValue({
      success: true,
      data: {
        id: 'customer-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '0771234567',
        role: 'CUSTOMER',
      },
    });

    const result = await authService.register({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '0771234567',
      address: '  12 Main Street, Colombo  ',
      password: 'Password123',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/auth/register',
      {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '0771234567',
        address: '12 Main Street, Colombo',
        password: 'Password123',
      },
      {
        authenticated: false,
      },
    );

    expect(result).toEqual({
      id: 'customer-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '0771234567',
      role: 'CUSTOMER',
    });
  });

  it('sends login credentials and stores only returned authentication data', async () => {
    const backendUser = {
      id: 'customer-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'CUSTOMER',
    };

    apiClient.post.mockResolvedValue({
      success: true,
      data: {
        token: 'test-jwt-token',
        user: backendUser,
      },
    });

    const result = await authService.login({
      email: 'jane@example.com',
      password: 'Password123',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/auth/login',
      {
        email: 'jane@example.com',
        password: 'Password123',
      },
      {
        authenticated: false,
      },
    );

    expect(authStorage.saveAuth).toHaveBeenCalledWith(
      'test-jwt-token',
      backendUser,
    );

    expect(authStorage.saveAuth).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        password: expect.anything(),
      }),
    );

    expect(result).toEqual(backendUser);
  });

  it('requests a reset email through the public shared API client', async () => {
    apiClient.post.mockResolvedValue({
      success: true,
      message: 'If an eligible account exists, a reset email has been sent.',
    });

    await authService.requestPasswordReset('  USER@Example.com  ');

    expect(apiClient.post).toHaveBeenCalledWith(
      '/auth/forgot-password',
      { email: 'user@example.com' },
      { authenticated: false },
    );
    expect(authStorage.saveAuth).not.toHaveBeenCalled();
  });

  it('resets a password through the public API using only token and newPassword', async () => {
    apiClient.post.mockResolvedValueOnce({
      success: true,
      message: 'Password has been reset.',
    });

    await authService.resetPassword({
      token: 'test-reset-token',
      newPassword: 'NewPassword123',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/auth/reset-password',
      { token: 'test-reset-token', newPassword: 'NewPassword123' },
      { authenticated: false },
    );
    expect(authStorage.saveAuth).not.toHaveBeenCalled();
  });

  it('clears authentication storage during logout', () => {
    authService.logout();

    expect(authStorage.clearAuth).toHaveBeenCalledTimes(1);
  });

  it('returns the stored current user', () => {
    const storedUser = {
      id: 'customer-1',
      role: 'CUSTOMER',
    };

    authStorage.getUser.mockReturnValue(storedUser);

    expect(authService.getCurrentUser()).toEqual(storedUser);
  });

  it('reports authenticated when a token exists', () => {
    authStorage.getToken.mockReturnValue('test-jwt-token');

    expect(authService.isAuthenticated()).toBe(true);
  });

  it('reports unauthenticated when no token exists', () => {
    authStorage.getToken.mockReturnValue(null);

    expect(authService.isAuthenticated()).toBe(false);
  });
});
