import authStorage from './auth/authStorage';
import { CUSTOMER } from '../config/roles';
import {
  CHATBOT_MAX_MESSAGE_LENGTH,
  CHATBOT_MAX_TRANSCRIPT_MESSAGES,
  CHATBOT_INQUIRY_TYPES,
  CHATBOT_RESPONSE_STATUSES,
} from '../config/chatbot';

const HISTORY_KEY = 'osms_chat_history';
const HISTORY_VERSION = 1;
const RESPONSE_STATUSES = Object.values(CHATBOT_RESPONSE_STATUSES);

// Invalidate pending writers even when logout/login uses the same Customer ID.
let sessionGeneration = 0;
let canRestoreHistory = true;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function currentCustomerId() {
  try {
    const user = authStorage.getUser();
    return authStorage.getToken() &&
      user?.role === CUSTOMER &&
      isNonEmptyString(user.id)
      ? user.id
      : null;
  } catch {
    return null;
  }
}

export function isChatHistorySessionActive(session) {
  return (
    isRecord(session) &&
    session.generation === sessionGeneration &&
    isNonEmptyString(session.customerId) &&
    session.customerId === currentCustomerId()
  );
}

function normalizeMessages(messages) {
  if (
    !Array.isArray(messages) ||
    messages.length > CHATBOT_MAX_TRANSCRIPT_MESSAGES
  ) {
    return null;
  }

  const ids = new Set();
  const normalized = [];

  for (const message of messages) {
    if (
      !isRecord(message) ||
      !isNonEmptyString(message.id) ||
      ids.has(message.id) ||
      !isNonEmptyString(message.text) ||
      !['user', 'assistant'].includes(message.role)
    ) {
      return null;
    }

    ids.add(message.id);
    const safeMessage = {
      id: message.id,
      role: message.role,
      text: message.text,
    };

    if (message.role === 'user') {
      if (message.text.length > CHATBOT_MAX_MESSAGE_LENGTH) {
        return null;
      }
    } else {
      if (
        !isNonEmptyString(message.chatId) ||
        !CHATBOT_INQUIRY_TYPES.includes(message.inquiryType) ||
        !RESPONSE_STATUSES.includes(message.responseStatus)
      ) {
        return null;
      }
      safeMessage.chatId = message.chatId;
      safeMessage.inquiryType = message.inquiryType;
      safeMessage.responseStatus = message.responseStatus;
    }

    normalized.push(safeMessage);
  }

  return normalized;
}

/**
 * Capture the current history owner/version before starting async work.
 * This is a UI lifecycle guard, not an authentication/security mechanism.
 */
export function createChatHistorySession() {
  const customerId = currentCustomerId();
  if (!customerId) {
    clearChatHistory();
    return null;
  }
  return Object.freeze({ customerId, generation: sessionGeneration });
}

export function loadChatHistory(session) {
  if (!isChatHistorySessionActive(session) || !canRestoreHistory) {
    return [];
  }

  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    if (raw === null) {
      return [];
    }
    const stored = JSON.parse(raw);
    const messages =
      isRecord(stored) &&
      stored.version === HISTORY_VERSION &&
      stored.customerId === session.customerId
        ? normalizeMessages(stored.messages)
        : null;

    if (messages === null) {
      removeStoredHistory();
      return [];
    }
    return messages;
  } catch {
    removeStoredHistory();
    return [];
  }
}

/**
 * Save a complete safe transcript; false means inactive session or storage failure.
 * Invalid messages throw a safe local error. Never truncate history or response text.
 */
export function saveChatHistory(session, messages) {
  if (!isChatHistorySessionActive(session)) {
    return false;
  }

  const safeMessages = normalizeMessages(messages);
  if (safeMessages === null) {
    throw Object.assign(new Error('Chat history could not be saved.'), {
      code: 'INVALID_CHAT_HISTORY',
    });
  }

  try {
    sessionStorage.setItem(
      HISTORY_KEY,
      JSON.stringify({
        version: HISTORY_VERSION,
        customerId: session.customerId,
        messages: safeMessages,
      }),
    );
    canRestoreHistory = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Purge only chatbot history; callers must continue logout if storage is blocked.
 * Disable restoration in memory so a failed purge cannot expose stale history.
 */
function removeStoredHistory() {
  canRestoreHistory = false;
  try {
    sessionStorage.removeItem(HISTORY_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearChatHistory() {
  sessionGeneration += 1;
  return removeStoredHistory();
}
