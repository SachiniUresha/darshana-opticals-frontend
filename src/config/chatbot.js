// DDP-060 API contract / Accepted ADR-010 sections 9.4 and 11.1.
// These values support UI validation; backend validation remains authoritative.
export const CHATBOT_MAX_MESSAGE_LENGTH = 500;
export const CHATBOT_MAX_CONTEXT_MESSAGES = 6;
export const CHATBOT_MAX_SESSION_MESSAGES = 20;

export const CHATBOT_RESPONSE_STATUSES = Object.freeze({
  ANSWERED: 'ANSWERED',
  UNSUPPORTED: 'UNSUPPORTED',
  FAILED: 'FAILED',
  ESCALATED_CONTACT_PROVIDED: 'ESCALATED_CONTACT_PROVIDED',
});

export const CHATBOT_INQUIRY_TYPES = Object.freeze([
  'STORE_INFO',
  'SERVICES',
  'PRODUCT_CATALOG',
  'ORDER_STATUS_GUIDANCE',
  'POLICY_WARRANTY',
  'GENERAL_INQUIRY',
  'UNSUPPORTED_OTHER',
]);
