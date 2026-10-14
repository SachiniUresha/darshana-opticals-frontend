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

Both design-context requests failed because the connected Figma Starter plan reached
its MCP call limit. Exact geometry, colours, typography, icons and assets remain
unverified. Obtain design context before implementing the visual step; do not claim
a verified Figma match from the written description alone.

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
- Exact visual verification is blocked by Figma access. Service work can proceed
  independently after the next approval.

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
