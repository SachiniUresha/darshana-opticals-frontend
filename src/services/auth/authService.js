import apiClient from '../apiClient';
import authStorage from './authStorage';
import { clearChatHistory } from '../chatHistoryStorage';

async function register({ firstName, lastName, email, phone, password }) {
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();

  const response = await apiClient.post(
    '/auth/register',
    {
      name,
      email,
      phone,
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
  logout,
  getCurrentUser,
  updateCurrentUser,
  isAuthenticated,
};

export default authService;
