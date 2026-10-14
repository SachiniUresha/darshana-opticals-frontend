# Customer chatbot integration review (frontend #29 / DDP-061)

Review date: 2026-10-14 (Asia/Colombo).

## Scope and approved workflow

Implement the Customer chatbot through the existing shared application shell.
The user approved branch `feature/29-customer-chatbot-widget`, using GitHub
issue #29 rather than the DDP-061 number in the branch name. Each step requires
user approval before work and a commit before the next step starts.

Step 1 is documentation and branch preparation only.

## Repository baseline

All four origins were fetched on the review date. Each local develop HEAD matched
its fetched origin/develop, and all four worktrees were clean before branch creation.

| Repository | Reviewed develop commit                    |
| ---------- | ------------------------------------------ |
| frontend   | `c376d4d84163b1f71af023a30e49e9e0d7dc2145` |
| backend    | `954861c2c005781a8999b38edeccc41f750466be` |
| documents  | `20d126c6d3e09c84dbd087b983f38e3f748be704` |
| infra      | `12c707f1dbee5ae96e693dd98eec3a66f6fc3dcb` |

Sources inspected: frontend and backend `.standards/STANDARDS.md`, documents
`standards/coding-standards.md`, Accepted ADR-010 and ADR-002, clinical privacy
requirements in ADR-001, SRS FR-011 text, relevant SDS chatbot references and
accessibility/security text, frontend auth/client/layout/routes and CI configuration,
and backend chatbot routes, validation, controller, service, constants and tests.

GitHub dependencies documents#20, documents#6, backend#55, frontend#4 and frontend#9
are closed. Backend#55 is marked completed. This confirms dependency issue state,
not a live deployment or provider smoke test.

Standards require focused modules, shared services, safe errors, Conventional
Commits, meaningful tests with at least 80% coverage of new code, lint/format checks,
a PR against develop, and peer approval before merge.

## Authoritative API contract

Use the existing `src/services/apiClient.js` with authentication enabled.
With the existing API base URL ending in `/api`, submit to `/v1/chatbot/query`.
The backend also exposes an alias, but Swagger documents the versioned route.

Request fields:

- `message`: non-empty string, at most 500 characters.
- `history`: optional array of at most 6 entries, each containing only
  `role` (`user` or `assistant`) and `text` (string, at most 500 characters).

Never submit customer identity, inquiry classification, response status, provider
configuration, system instructions, profile, clinical records or payment data.

The HTTP 200 envelope is `{ status: 'success', data: { chatId, inquiryType,
responseStatus, responseText } }`. HTTP success alone does not mean the provider
answered: inspect the returned canonical response status.

| Response status              | UI responsibility                                               |
| ---------------------------- | --------------------------------------------------------------- |
| `ANSWERED`                   | Render the backend answer as plain text.                        |
| `UNSUPPORTED`                | Render the backend unsupported/missing-knowledge fallback.      |
| `FAILED`                     | Render the backend failure fallback with a clear failure state. |
| `ESCALATED_CONTACT_PROVIDED` | Render the backend contact/escalation response.                 |

Inquiry types are backend-owned: STORE_INFO, SERVICES, PRODUCT_CATALOG,
ORDER_STATUS_GUIDANCE, POLICY_WARRANTY, GENERAL_INQUIRY and UNSUPPORTED_OTHER.

Documented HTTP errors: 422 validation, 401 authentication, 403 authorization and
429 rate limiting. The backend chatbot limit is 10 requests/minute per Customer;
the shared general API limiter also applies. Provider failures currently become
HTTP 200 responses with FAILED. Network, unexpected HTTP and malformed-response
failures need safe frontend messages without raw error payloads.

## Authentication, privacy and conversation lifecycle

Only authenticated CUSTOMER users receive the widget. Reuse `useAuth` and
existing role constants. Backend JWT/RBAC remains the security boundary.

Reuse the existing 401 pattern: call shared logout and navigate to `/login` with
replace. Stop sends after 403. Prevent duplicate pending sends and discard late
responses after logout, identity changes or unmount.

ADR-010 explicitly approves active-tab `sessionStorage` history and requires
purging `osms_chat_history` on logout. Preserve state on minimize, navigation and
refresh within the same authenticated session. Scope stored state to its owner;
clear on identity/session changes and handle unavailable or malformed storage.
No server history endpoint exists and no historical conversation retrieval is
approved. Persist only the safe UI transcript, never provider payloads or secrets.

Display text safely without HTML injection, Markdown execution or automatic links.
Keep provider access, retrieval, classification and prompt construction on the backend.
Do not add voice, uploads, provider selection, knowledge administration or OSMS actions.

## Design and accessibility

Requested references:

- [Assistant panel, node 187:1550](https://www.figma.com/design/OecN23wEqdSIWsY4xjWwUQ/Darshana-Opticals?node-id=187-1550)
- [Blue launcher, node 187:4](https://www.figma.com/design/OecN23wEqdSIWsY4xjWwUQ/Darshana-Opticals?node-id=187-4)

Initial design-context requests failed because the connected Figma Starter plan
reached its MCP call limit. The user subsequently supplied Assistant-panel and
blue-launcher screenshots after being offered the screenshot-reference workflow.
Step 4 uses these approved visual references and existing app typography/icons.
Original Figma node metadata and asset matching remain unverified.

The user also requires a draggable launcher on Customer pages. Separate dragging
from activation, support pointer/touch interaction and keyboard positioning, and
keep launcher/panel within the viewport after movement, resizing and mobile keyboard
changes. Integrate once through AppLayout without duplicating pages or shells.

SDS section 5.3 describes trapping focus in the open chat panel and returning it to
the launcher on close; ADR-010 also references modal focus behaviour. Use proper
dialog semantics and background interaction handling for that approved pattern,
accessible open/close/send controls, Escape, visible focus, sender labels and polite
announcements. Do not steal focus on every response. Verify wrapping, scrolling,
contrast, mobile input access and critical page controls.

## Contract details to resolve during integration

- ADR-010 specifies a maximum of 20 messages per session. The current stateless
  API does not enforce a session-wide count or define a session-reset operation.
  UI retention is not a replacement for authoritative backend enforcement.
- Assistant output is not capped to 500 characters, but every history text entry is.
  Keep complete responses readable in the UI; do not blindly resend oversized
  responses or silently invent a truncation/summarization policy.
- The ADR permits one backend retry for transient provider errors. It does not
  authorize automatic browser retries. Its failure fallback invites trying again
  later; a manual retry may target a failed interaction without duplicating its
  Customer bubble. Never retry answered/unsupported interactions automatically.
- Original Figma node metadata remains unavailable due to the tool quota. The user
  supplied screenshots for the visual step; verification uses those references.

## Proposed separately approved implementation steps

1. Branch and integration review (this commit).
2. Centralized chatbot service, documented request/response mapping and service tests.
3. Owner-scoped session history and shared logout cleanup, with lifecycle tests.
4. Figma-based launcher/panel, dragging, accessibility and AppLayout integration.
5. Connect message flow, canonical statuses and safe errors; add integration,
   duplicate-send, stale-response and malicious-text tests.
6. Run regression tests, coverage, lint, formatting and build; verify responsive
   browser behaviour and backend smoke flows, update changelog and prepare PR.

Each implementation step includes its relevant tests and a commit before requesting
approval for the next. A PR, peer review, CI, merge and moving the issue to Done
remain pending; this review does not mark the issue complete.

## Step 2 implementation

Added `src/services/chatbotService.js` and shared API contract constants in
`src/config/chatbot.js`. Call `sendMessage({ message, history })` with prior
session messages when available. The service trims the question, selects the last
six history entries and sends only documented fields using the existing JWT client.

The return value contains only `chatId`, `inquiryType`, `responseStatus` and
`responseText`. All four canonical response statuses are preserved, including
FAILED responses delivered with HTTP 200. Response text remains a complete plain
string; safe DOM rendering belongs to the forthcoming widget step.

Invalid input rejects with code `INVALID_CHATBOT_REQUEST`; malformed successful
responses reject with `INVALID_CHATBOT_RESPONSE`. API errors retain the shared
client's status/code for later auth and safe UI handling. The UI must use safe
error mappings rather than displaying arbitrary error.message values.

History entries over 500 characters are rejected rather than silently truncated.
No provider calls, retries, history endpoint or transcript persistence were added.

Validation: 84 new service/client tests passed; the full frontend suite passed
430 tests across 38 files. New service and contract constants achieved 100%
statement, branch, function and line coverage. Repository lint, formatting and
production build passed. Shared-client integration tests mock transport; live
backend/provider and browser-widget verification remain pending.

## Step 3 implementation

Added `src/services/chatHistoryStorage.js` and connected cleanup to the existing
shared authentication service. Successful login starts a fresh chat session; logout
purges chat history before clearing authentication. A failed login leaves the
current authenticated conversation intact.

The storage API provides `createChatHistorySession()`, `loadChatHistory(session)`,
`saveChatHistory(session, messages)` and `clearChatHistory()`. Capture the history
session before async work and retain that handle for writes. Owner/version checks
reject writes after logout, role/account changes and same-Customer re-login.
These are frontend lifecycle guards; backend authentication remains authoritative.

The active-tab `osms_chat_history` envelope contains schema version, Customer ID
and safe messages only. User messages contain `id`, `role` and `text`.
Assistant messages additionally retain `chatId`, `inquiryType` and
`responseStatus` so restored fallbacks keep their backend status. Extra fields are
discarded. Complete assistant responses, including text longer than 500 characters,
remain intact; the API-context length mismatch documented above remains unresolved.

Transcript validation follows the ADR's 20-message session bound and 500-character
Customer message bound. Oversized or malformed transcripts are rejected rather
than trimmed. This frontend storage bound does not enforce the missing backend
session-wide request limit.

Foreign, malformed or incompatible stored transcripts are discarded. Storage read
failures restore no messages. Failed writes return false so the future widget can
retain its in-memory state; quota/storage errors do not crash login or logout.
Cleanup touches only the chatbot key. If removal is blocked, restoration is
suppressed in the current module lifetime and pending writers are invalidated;
the browser's denied storage operation cannot guarantee physical deletion.

The storage layer restores within the same authenticated tab after module reload
and reopen. Widget mounting, in-memory state and visible refresh/minimize behaviour
will be wired and verified in the forthcoming UI steps. No server history endpoint,
new authentication context, permanent localStorage transcript or provider calls
were added.

Validation: 54 new storage/auth lifecycle tests passed. The full frontend suite
passed 484 tests across 40 files; the history storage module achieved 100%
statement, branch, function and line coverage. Lint, repository formatting and
production build passed.

## Step 4 implementation

After Figma quota errors, the user supplied Assistant-panel and blue-launcher
screenshots in response to the offered screenshot-reference workflow. This step
implements those supplied references; original Figma typography/vector metadata
was not available. Existing app typography/tokens and the shared EyeIcon are reused.

Added the Customer-only chatbot once in AppLayout using the existing useAuth hook.
The panel includes the navy header, greeting, suggested-question rows, sender-labelled
grey/blue bubbles, plain-text history, composer and accessible close controls.
The header identifies the store without claiming verified AI-provider availability.
Quick questions fill ordinary input; they do not execute OSMS actions.

The launcher has the blue message icon and yellow dot. Mouse/touch pointer dragging
and Alt+arrow-key movement are bounded to the visible viewport. A drag does not
accidentally activate the widget. Minimized position, draft and loaded transcript
remain intact across close/reopen. The open panel/close bubble align within the
visible viewport; on very short keyboard-height viewports only the header close
control remains visible so the composer stays accessible.

SDS-approved modal behaviour uses dialog semantics, background inert/aria-hidden
handling, focus containment, Escape and focus return, restoring previous page
attributes and scroll state after closing/unmounting. Messages use a polite log,
sender labels, complete plain strings and readable canonical fallback labels.
Long text wraps, and scrolling respects a customer reading older messages.

This commit completes the visual shell only. ChatbotPanel exposes a send callback
for Step 5; the AppLayout widget does not yet connect it, and Send remains disabled
without that handler. No invented answers or backend/provider calls were added.
Actual send, pending-request persistence, error/retry/auth flows remain in Step 5.

Validation: 43 new UI/position tests passed. The full frontend suite passed 527
tests across 43 files. New chatbot components/position utilities achieved 100%
coverage; dialog/drag hooks exceeded 95% line and branch coverage. Lint, repository
formatting and production build passed.

An isolated headless Edge smoke review with fictional auth/history and mocked
unrelated API traffic verified native mouse/touch dragging, modal focus/Escape,
Customer/staff visibility, desktop 1024x768, mobile 390x844, narrow 320x640 and
compact 390x280 layouts. Input and close controls stayed in view, suggested chips
did not overflow, screenshots were visually inspected, and no runtime exceptions
were observed. This is not a live chatbot/backend/provider end-to-end test.
