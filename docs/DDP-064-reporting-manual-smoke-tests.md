# DDP-064 - Reporting Dashboard Manual Smoke Tests

Frontend issue: https://github.com/darshana-opticals-osms/frontend/issues/30

This is a verification checklist, not evidence that manual tests have passed. Record results before requesting PR approval.

## Setup

- [ ] Backend `develop` running with real report endpoints, seeded/approved test data, and authorized sessions
- [ ] Frontend feature branch running locally (`npm run dev`)
- [ ] No real payment/customer credentials or report exports committed to Git

## System Admin

- [ ] Log in and open `/admin/reports/sales` and `/admin/reports/inventory`
- [ ] Review KPI values against the authoritative `/api/reports/sales` and `/api/reports/inventory` responses
- [ ] Change branch, approved date/stock filters, and grouping; verify fresh backend requests and chart/table values
- [ ] Test empty states, detail pagination, sorting, CSV export and Excel export with approved test data
- [ ] Inspect downloaded file schema/contents for expected scope and masked customer fields (no clinical/payment secrets)

## Branch Manager

- [ ] Log in and open `/staff/reports/sales` and `/staff/reports/inventory`
- [ ] Verify no cross-branch selector or organization-wide financial scope is exposed
- [ ] Verify backend restricts both visible data and downloads to the assigned branch

## Security and resilience

- [ ] Unauthenticated navigation is blocked by the existing shared guard
- [ ] Unauthorized role cannot access reports through direct URLs
- [ ] Expired session (`401`) follows normal logout/login behaviour
- [ ] Forbidden response (`403`) displays safe feedback with no stale privileged data
- [ ] Network errors, retry, and empty reports behave without fake values or raw error disclosure
- [ ] No report data/PII is written to console logs or browser storage
- [ ] Inventory breakdown shows current stock only, not a fabricated historical trend

## Accessibility and responsiveness

- [ ] Keyboard-only navigation works through filters, exports, details, and pagination
- [ ] Focus indicator visible on controls and scrollable chart/table regions
- [ ] Semantic table headings and accessible chart values work with a screen reader
- [ ] Desktop, tablet and phone widths do not cause uncontrolled horizontal overflow
- [ ] Browser console is free of unexpected report errors

## Final regression and PR

- [ ] `npm run test` (full suite), `npm run lint`, `npm run format:check`, `npm run build`, `git diff --check` pass
- [ ] Existing inventory, loyalty, checkout/payment, order, appointment and prescription screens smoke-tested
- [ ] PR opened against `develop`, references `Closes #30`, and describes RBAC/branch scope, backend authority, filters, masking, exports, charts and tests
- [ ] CI passes and reviewer approval is received before merge
