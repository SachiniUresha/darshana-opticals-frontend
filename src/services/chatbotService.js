import apiClient from './apiClient';
import {
  CHATBOT_MAX_MESSAGE_LENGTH,
  CHATBOT_MAX_CONTEXT_MESSAGES,
  CHATBOT_RESPONSE_STATUSES,
  CHATBOT_INQUIRY_TYPES,
} from '../config/chatbot';

const RESPONSE_STATUS_VALUES = Object.values(CHATBOT_RESPONSE_STATUSES);
const HISTORY_ROLES = ['user', 'assistant'];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function invalidRequest(message) {
  return Object.assign(new Error(message), { code: 'INVALID_CHATBOT_REQUEST' });
}

function normalizeHistoryItem(item) {
  if (
    !isRecord(item) ||
    typeof item.role !== 'string' ||
    !HISTORY_ROLES.includes(item.role.toLowerCase()) ||
    typeof item.text !== 'string'
  ) {
    throw invalidRequest(
      'Chat history must contain user or assistant text messages.',
    );
  }

  if (item.text.length > CHATBOT_MAX_MESSAGE_LENGTH) {
    throw invalidRequest(
      'Chat history messages must not exceed 500 characters.',
    );
  }

  // Keep full text unchanged. Do not truncate or enrich context with UI metadata.
  return { role: item.role.toLowerCase(), text: item.text };
}

function buildRequest(request) {
  if (!isRecord(request) || !isNonEmptyString(request.message)) {
    throw invalidRequest('Enter a question before sending.');
  }

  if (request.message.length > CHATBOT_MAX_MESSAGE_LENGTH) {
    throw invalidRequest('Questions must not exceed 500 characters.');
  }

  const body = { message: request.message.trim() };

  if (request.history !== undefined) {
    if (!Array.isArray(request.history)) {
      throw invalidRequest('Chat history must be a list of messages.');
    }

    // ADR-010 permits only the last six messages as provider context.
    body.history = Array.from(
      request.history.slice(-CHATBOT_MAX_CONTEXT_MESSAGES),
      normalizeHistoryItem,
    );
  }

  return body;
}

function normalizeResponse(response) {
  const data = response?.data;

  if (
    !isRecord(response) ||
    response.status !== 'success' ||
    !isRecord(data) ||
    !isNonEmptyString(data.chatId) ||
    !CHATBOT_INQUIRY_TYPES.includes(data.inquiryType) ||
    !RESPONSE_STATUS_VALUES.includes(data.responseStatus) ||
    !isNonEmptyString(data.responseText)
  ) {
    throw Object.assign(
      new Error('Invalid chatbot response received from the server.'),
      { code: 'INVALID_CHATBOT_RESPONSE' },
    );
  }

  // Return only documented fields, preserving backend text and status verbatim.
  return {
    chatId: data.chatId,
    inquiryType: data.inquiryType,
    responseStatus: data.responseStatus,
    responseText: data.responseText,
  };
}

/**
 * Submit one Customer question through the shared authenticated API client.
 * History is optional active-session context, not a server history operation.
 * No client retries, provider calls, classification or persistence happen here.
 */
export async function sendMessage(request = {}) {
  const body = buildRequest(request);
  const response = await apiClient.post('/v1/chatbot/query', body, {
    authenticated: true,
  });

  return normalizeResponse(response);
}
