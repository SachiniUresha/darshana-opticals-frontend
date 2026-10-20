# DDP-094 â€” Admin Staff and Doctor Management (Frontend)

## Purpose and scope

DDP-094 (frontend issue #61, PR #62) adds management of existing Staff Members and Doctors to the Darshana Opticals OSMS System Administrator workspace. It extends the existing Admin Dashboard without replacing the Add Staff or Add Doctor workflows. DDP-093 (backend PR #94) provides the authoritative management API and business rules.

Doctors are directory records for appointment scheduling; they are **not** authenticated Staff accounts. Hard-delete actions are not supported.

## Navigation and permissions

All routes below are accessible only to `SYSTEM_ADMIN` through the existing protected frontend routes. The backend independently enforces authorization.

| Path                 | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `/admin`             | Admin Dashboard, including management quick actions |
| `/admin/staff`       | Staff Management                                    |
| `/admin/staff/new`   | Existing Add Staff workflow                         |
| `/admin/doctors`     | Doctor Management                                   |
| `/admin/doctors/new` | Existing Add Doctor workflow                        |

The Admin Sidebar exposes these destinations. Existing admin navigation, including inventory and reporting, remains available.

## Staff Management

- List staff with name, email, role, assigned branch, status, and actions.
- Filter by Active/Inactive status, search by name/email, and navigate paginated results.
- Edit approved profile details: name, email, phone, and address.
- Reassign roles only among `BRANCH_MANAGER`, `BRANCH_ASSISTANT`, and `OPTOMETRIST`.
- Assign a valid existing branch or clear the assignment where permitted.
- Activate or deactivate accounts with confirmation before deactivation.
- Refresh server data after confirmed updates. Display loading, empty, validation, permission, and recoverable error states.
- Branch options use the existing `useBranches()` hook. Branch loading and failure states are shown with a retry action; staff directory errors remain independently recoverable.

Staff deactivation prevents new logins and rejects subsequent protected requests using an existing Staff JWT. Backend authentication checks current Staff status, role, and branch for protected requests; the frontend does not implement authorization by hiding controls alone.

## Doctor Management

- List Doctors by name, specialization, and Active/Inactive status; search and switch status tabs.
- Edit name and specialization using the management API.
- Activate or deactivate a Doctor with confirmation and server-confirmed feedback.
- Preserve Doctor identity and historical Doctor Session/Appointment references.

Inactive Doctors are excluded from the active Doctor directory and new Doctor Session selection. The backend rejects attempts to assign an inactive Doctor to a new session. Existing appointment history is not deleted or silently cancelled when a Doctor is deactivated.

## Backend integration

Set `VITE_API_BASE_URL` to the backend API base, for example `http://localhost:5000/api` in the local `.env` file (which must not be committed). The frontend service layer centralizes requests in `staffAdminService.js` and `doctorAdminService.js` via the shared API client.

| Method  | API path                    | Purpose                                         |
| ------- | --------------------------- | ----------------------------------------------- |
| `GET`   | `/admin/staff`              | List/filter/page Staff Members                  |
| `GET`   | `/admin/staff/:id`          | Retrieve Staff details                          |
| `PATCH` | `/admin/staff/:id`          | Edit Staff profile                              |
| `PATCH` | `/admin/staff/:id/role`     | Change Staff role                               |
| `PATCH` | `/admin/staff/:id/branch`   | Reassign/clear Staff branch                     |
| `PATCH` | `/admin/staff/:id/status`   | Activate/deactivate Staff                       |
| `GET`   | `/admin/doctors`            | List/filter Doctors for administration          |
| `PATCH` | `/admin/doctors/:id`        | Edit Doctor name/specialization                 |
| `PATCH` | `/admin/doctors/:id/status` | Activate/deactivate Doctor                      |
| `POST`  | `/admin/staff`              | Existing Add Staff workflow                     |
| `POST`  | `/doctors`                  | Existing Add Doctor workflow                    |
| `GET`   | `/doctors`                  | Active Doctor directory for supported workflows |

Staff list responses include top-level pagination metadata. Branch unassignment uses `{ "branchId": null }`. Backend permissions and validation remain authoritative.

## Known limitations and design boundaries

- No hard delete, password editing, or Doctor account/role/branch management is provided through these pages.
- Staff roles and branch assignments are restricted to backend-supported values and existing branches.
- Appointment Doctor Session creation is currently restricted by the backend to the approved Gampaha Main Branch; the admin management UI does not change that scheduling rule.
- Status changes preserve historical records; they do not automatically migrate orders, prescriptions, sessions, or appointments.
- Backend ADR-012 audit consistency is tracked separately for integrated release readiness; this frontend feature does not implement audit persistence.
- Reporting table currency-label cleanup is an independent UI refinement included in frontend PR #62 as a separate commit; it is not necessary for Staff or Doctor Management functionality.

## Verification record (2026-10-20)

The following manual results were reported by the feature implementer against the DDP-093 backend with test data:

- Staff Management UI: **6/6 passed** (admin access, editing, role, branch, deactivate, reactivate).
- Staff JWT and authorization: **6/6 passed** (protected access before deactivation, existing JWT rejected with HTTP 401, inactive login rejected, reactivation, non-admin HTTP 403).
- Doctor and Appointment integration: **7/7 passed** (edit, status changes, active-directory/session exclusion, backend rejection of inactive Doctor assignment, historical records preserved).
- Existing Add Staff and Add Doctor regression: **4/4 passed** (validation, creation, list visibility).
- Frontend regression after branch-loading fix: **108/108 test files; 1,314/1,314 tests passed**. Prettier, ESLint, production build, and Git whitespace checks passed.

These are local/manual verification results, not independently attached network logs or production acceptance evidence. Re-run CI after the updated feature branch is pushed and obtain reviewer approval before merging.

## Related work

- Frontend: issue #61 / PR #62 (DDP-094).
- Backend: DDP-093 / PR #94 (merged into backend `develop`).
- Documentation coordination: notify the DDP-088 documentation owner of this frontend behavior and API dependency.
- Architecture references: ADR-002 (RBAC), ADR-007 (appointments), ADR-012 (audit trail).
