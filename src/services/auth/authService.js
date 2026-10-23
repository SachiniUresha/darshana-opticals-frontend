import apiClient from '../apiClient';
import authStorage from './authStorage';
import { clearChatHistory } from '../chatHistoryStorage';

async function register({
  firstName,
  lastName,
  email,
  phone,
  address,
  password,
}) {
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();

  const response = await apiClient.post(
    '/auth/register',
    {
      name,
      email,
      phone,
      address: address.trim(),
      password,
    },
    {
      authenticated: false,
    },
  );

  return response.data;
}

async function login({ email, password }) {
  const response = await apiClient.post(
    '/auth/login',
    {
      email,
      password,
    },
    {
      authenticated: false,
    },
  );

  const { token, user } = response.data;

  clearChatHistory();
  authStorage.saveAuth(token, user);

  return user;
}

// Public recovery endpoint: do not attach JWTs or save account information.
async function requestPasswordReset(email) {
  return apiClient.post(
    '/auth/forgot-password',
    { email: email.trim().toLowerCase() },
    { authenticated: false },
  );
}

// Public recovery endpoint. Only the reset token and new password go to the API.
async function resetPassword({ token, newPassword }) {
  return apiClient.post(
    '/auth/reset-password',
    { token, newPassword },
    { authenticated: false },
  );
}

function logout() {
  clearChatHistory();
  authStorage.clearAuth();
}

function getCurrentUser() {
  return authStorage.getUser();
}

function updateCurrentUser(user) {
  authStorage.saveUser(user);

  return user;
}

function isAuthenticated() {
  return Boolean(authStorage.getToken());
}

const authService = {
  register,
  login,
  requestPasswordReset,
  resetPassword,
  logout,
  getCurrentUser,
  updateCurrentUser,
  isAuthenticated,
};

export default authService;
