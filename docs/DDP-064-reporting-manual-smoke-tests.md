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

## Manual verification results � 2026-10-19

Environment: Local frontend with backend develop (PR #90 merged).

### Verified PASS

- System Admin Sales and Inventory reporting pages load.
- Net Revenue progression and Order Volume visualizations display.
- System Admin Payment Method Breakdown displays.
- System Admin inventory valuation is visible.
- Branch Manager Sales reporting loads with appropriate zero-sales state.
- Branch Manager restricted financial KPIs are hidden.
- Branch Manager has no cross-branch selector.
- Admin Sales CSV and Excel exports download successfully.
- Admin Inventory CSV and Excel exports download successfully.
- Manager Inventory export excludes Retail Valuation.
- Manager Sales Excel Executive Summary excludes Refund Deductions and Average Order Value.

### Pending / Not manually verified

- Complete filter, pagination and sorting combinations.
- Manual 401/403 session and authorization scenarios.
- Full keyboard, screen-reader and responsive checks.
- Browser storage/log inspection and unrelated feature smoke tests.

### Automated verification

- 105 test files / 1237 tests passed before the final API response compatibility fix.
- ESLint, Prettier and production build passed before that fix.
- Final regression checks required after the compatibility fix.
