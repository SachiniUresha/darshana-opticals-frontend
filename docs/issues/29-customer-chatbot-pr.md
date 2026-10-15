# Proposed PR title

feat(chatbot): add Customer Darshana Assistant widget (#29)

# Proposed PR description

Customers can open Darshana Assistant from a draggable blue launcher throughout
the shared application shell, ask questions through the documented backend API,
and see distinct processing, answered, unsupported and failure states.
Minimizing or navigating preserves the active conversation; manual retry replaces
a failed reply without duplicating the Customer question.

## Changes

- Integrate once through AppLayout and reuse shared authentication and API client.
- Match the supplied Assistant/launcher screenshots with responsive positioning,
  pointer/touch dragging and Alt+arrow keyboard movement.
- Add named controls, modal focus management, Escape/close focus restoration,
  sender semantics, live processing/error announcements and readable wrapping.
- Centralize canonical API mapping and reflect the 500-character message limit,
  last-six-message context and bounded active-tab transcript.
- Handle safe network/HTTP failures, 429 without automatic retries, normal
  application logout on 401 and stopped sending on 403.
- Integrate the latest develop appointment, staff-order and Navbar changes before validation.

## Security and privacy

Authenticated CUSTOMER access follows Accepted ADR-010/ADR-002; backend RBAC and
identity remain authoritative. Request bodies contain only documented message
and optional history fields. Responses render as plain text without injected HTML
or automatic links. Customer-scoped sessionStorage history is purged on logout
and guarded against stale responses/identity changes.

No browser provider SDK, provider secrets, client knowledge retrieval, hidden
prompts, clinical/payment/profile enrichment, autonomous actions, voice or uploads.

## Validation

- Frontend: 666 tests across 53 files pass; overall line coverage 94.89%.
- Backend: 30 existing chatbot integration/unit tests pass.
- Lint, Prettier and production build pass.
- Headless Edge against real Express/JWT and temporary MongoDB with the approved
  mock provider: grounded reply, unsupported/missing knowledge, provider failure
  and manual retry, real 401 cleanup, independent 403/422/429 and metadata-only DB.
- Browser checks: navigation/refresh history, nine Customer page shells, current
  mobile Navbar, narrow/mobile layouts, keyboard/dialog accessibility tree and
  focus contrast. No runtime exceptions.

## Review notes

The user approved issue-number branch naming:
`feature/29-customer-chatbot-widget`. Target branch: `develop`.

ADR-010 requires a session-wide 20-message limit, but the stateless backend has no
authoritative session count/reset contract. The frontend bound is a UX constraint.
Backend enforcement is tracked separately in
[backend #77](https://github.com/darshana-opticals-osms/backend/issues/77).
Backend output can exceed its history-entry limit; the Customer must explicitly
choose to omit optional earlier context before sending a question after such a
reply. Complete response text is retained and never silently summarized.

Original Figma metadata remains unavailable due to connector quota; implementation
uses the user-supplied screenshots. Live Gemini/deployment smoke, human
screen-reader/physical-device review, remote CI and approving peer review remain
outstanding. No live payment or every staff workflow is claimed.

See [integration review](./29-customer-chatbot-widget.md) for evidence
and limitations.

Refs #29 (DDP-061 / FR-011).
