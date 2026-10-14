import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import authService from '../src/services/auth/authService';
import authStorage from '../src/services/auth/authStorage';
import {
  createChatHistorySession,
  loadChatHistory,
  saveChatHistory,
} from '../src/services/chatHistoryStorage';

vi.mock('../src/services/apiClient', () => ({ default: { post: vi.fn() } }));

const user = { id: 'customer-a', role: 'CUSTOMER' };
const messages = [
  { id: 'message-1', role: 'user', text: 'A private question' },
];

describe('chat history with the shared authentication lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    authService.logout();
    authStorage.saveAuth('old-test-token', user);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    authService.logout();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('purges messages and auth data on shared logout and rejects late writes', () => {
    const session = createChatHistorySession();
    saveChatHistory(session, messages);

    authService.logout();

    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.getCurrentUser()).toBeNull();
    expect(sessionStorage.getItem('osms_chat_history')).toBeNull();
    expect(saveChatHistory(session, messages)).toBe(false);
    expect(createChatHistorySession()).toBeNull();
  });

  it.each(['customer-a', 'customer-b'])(
    'starts an empty conversation when a fresh login succeeds for %s',
    async (id) => {
      const oldSession = createChatHistorySession();
      saveChatHistory(oldSession, messages);
      const loggedInUser = { id, role: 'CUSTOMER' };
      apiClient.post.mockResolvedValueOnce({
        success: true,
        data: { token: 'new-test-token', user: loggedInUser },
      });

      const result = await authService.login({
        email: 'customer@example.test',
        password: 'test-only',
      });

      expect(result).toEqual(loggedInUser);
      expect(authStorage.getToken()).toBe('new-test-token');
      expect(loadChatHistory(createChatHistorySession())).toEqual([]);
      expect(saveChatHistory(oldSession, messages)).toBe(false);
    },
  );

  it('keeps the current session history when a login attempt fails', async () => {
    const session = createChatHistorySession();
    saveChatHistory(session, messages);
    apiClient.post.mockRejectedValueOnce(new Error('Invalid credentials'));

    await expect(
      authService.login({ email: 'wrong@example.test', password: 'wrong' }),
    ).rejects.toThrow('Invalid credentials');

    expect(loadChatHistory(session)).toEqual(messages);
    expect(authStorage.getToken()).toBe('old-test-token');
  });

  it('continues shared logout when chatbot history removal is blocked', () => {
    const session = createChatHistorySession();
    saveChatHistory(session, messages);
    const originalRemoveItem = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
      function (key) {
        if (key === 'osms_chat_history') throw new Error('Storage blocked');
        return originalRemoveItem.call(this, key);
      },
    );

    expect(() => authService.logout()).not.toThrow();
    expect(authStorage.getToken()).toBeNull();
    expect(authStorage.getUser()).toBeNull();
    expect(saveChatHistory(session, messages)).toBe(false);
  });
});
