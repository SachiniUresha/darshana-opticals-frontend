# Frontend — Darshana Opticals OSMS

[![Frontend CI](https://github.com/darshana-opticals-osms/frontend/actions/workflows/frontend-ci.yml/badge.svg?branch=develop)](https://github.com/darshana-opticals-osms/frontend/actions/workflows/frontend-ci.yml)
[![Test Coverage](https://img.shields.io/badge/coverage-94.89%25-brightgreen)](https://github.com/darshana-opticals-osms/frontend)
[![Tests Passing](https://img.shields.io/badge/tests-1341%20passed%20%7C%20110%20suites-success)](https://github.com/darshana-opticals-osms/frontend)
[![Code Quality](https://img.shields.io/badge/code%20style-Airbnb%20%2B%20Prettier-blue)](https://github.com/darshana-opticals-osms/frontend)
[![Course](https://img.shields.io/badge/course-SENG%2034213-orange)](https://github.com/darshana-opticals-osms)

> **University of Kelaniya — Faculty of Science**  
> **Software Engineering Teaching Unit**  
> **SENG 34213: System Development Project (Year 3, Semester 2 — 2026)**  
> **Client Organization:** Darshana Opticals  
> **Repository:** `darshana-opticals-osms/frontend`  
> **Default Integration Branch:** `develop` | **Production Branch:** `main`

---

## 1. Live Application & Demonstration Access

The frontend is continuously integrated and deployed to **Vercel** with automatic HTTPS, edge routing, and hardened security headers. The backend RESTful API service is hosted on **Render**.

| Resource                      | Target URL                                                                                                   | Description                                |
| :---------------------------- | :----------------------------------------------------------------------------------------------------------- | :----------------------------------------- |
| **Live Frontend Application** | [https://darshana-opticals.vercel.app](https://darshana-opticals.vercel.app/)                                | Production staging single-page application |
| **Backend REST API**          | [https://osms-backend-staging.onrender.com](https://osms-backend-staging.onrender.com/)                      | Live API service root                      |
| **Backend Health Check**      | [https://osms-backend-staging.onrender.com/api/health](https://osms-backend-staging.onrender.com/api/health) | API service availability monitor           |

### Evaluation Demo Accounts

The following dedicated demonstration accounts are provisioned for academic evaluation and milestone assessments.

| Role                     | Email                       | Password          | Primary Accessible Workspace                                                               |
| :----------------------- | :-------------------------- | :---------------- | :----------------------------------------------------------------------------------------- |
| **System Administrator** | `admin.dev@gmail.com`       | `DevPassword123!` | System Dashboard, Staff/Doctor Admin, Central Inventory, Executive Reports                 |
| **Branch Manager**       | `brachmanager@gmail.com`    | `DevPassword123!` | Branch Orders, Staff Appointments, Inventory & Thresholds, Sales Reports, Loyalty Program  |
| **Branch Assistant**     | `branchassistant@gmail.com` | `DevPassword123!` | In-Store Orders, Doctor Session Management, Appointment Booking & Slot Movement            |
| **Optometrist**          | `optometrist@gmail.com`     | `DevPassword123!` | Clinical Consultations, Patient Examination, Digital Optical Prescription Issuance         |
| **Customer**             | `kavindueka@gmail.com`      | `Amalka@123`      | Store Catalog, Cart & Checkout, PayHere Portal, Prescription & Order History, AI Assistant |

> **Evaluation Disclosure & Data Hygiene:**  
> These accounts are strictly reserved for academic grading and feature verification. They contain mock and sanitized data only, with no confidential customer or commercial records. Evaluation panels should confirm that the backend staging service is active via the health check endpoint prior to live evaluation.

---

## 2. Project Overview & Objectives

**Darshana Opticals Optical Shop Management System (OSMS)** is an end-to-end digital retail and healthcare management platform built for Darshana Opticals. The client-side application provides a high-performance, accessible Single Page Application (SPA) designed to unify customer eyecare services with optical retail operations.

### Key Objectives

- **Omnichannel Eyecare & Retail:** Enable customers to browse eyewear, filter products, schedule optometrist appointments, review optical prescriptions, and purchase frames/lenses online.
- **Role-Centric Operational Workspaces:** Deliver tailored workflows for System Administrators, Branch Managers, Branch Assistants, and Optometrists with strict role-based access control.
- **Clinical Digitization:** Digitize eye testing and prescription records (Sphere, Cylinder, Axis, Add) to ensure accurate lens crafting and rapid access to patient histories.
- **Traceable Engineering:** Ensure complete traceability between the approved Software Requirements Specification (SRS) and System Design Specification (SDS) from SENG 31242 into tested, maintainable, and deployed software in SENG 34213.

---

## 3. GitHub Multi-Repository Architecture

In accordance with Section 3.1 of the University Development Guideline, the project is structured under the `darshana-opticals-osms` GitHub Organisation across focused repositories:

| Repository                                                                             | Responsibility                                                          | Tech Stack                                          |
| :------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- | :-------------------------------------------------- |
| **[frontend](https://github.com/darshana-opticals-osms/frontend)** _(this repository)_ | Responsive client web application, customer portal, staff workspaces    | React 18, Vite, React Router 6, Vanilla CSS, Vitest |
| **[backend](https://github.com/darshana-opticals-osms/backend)**                       | RESTful API, authentication, business logic, PostgreSQL persistence     | Node.js, Express, PostgreSQL, JWT, Jest             |
| **[infra](https://github.com/darshana-opticals-osms/infra)**                           | Container configurations, deployment scripts, reverse proxy definitions | Docker, Docker Compose, CI/CD Actions               |
| **[tests](https://github.com/darshana-opticals-osms/tests)**                           | Cross-service end-to-end acceptance and contract tests                  | Playwright / Postman / Newman                       |
| **[documents](https://github.com/darshana-opticals-osms/documents)**                   | Academic documentation, updated SRS, SDS, ADRs, Sprint Retrospectives   | Markdown, LaTeX, PDF Artefacts                      |

- **GitHub Project Board:** [https://github.com/orgs/darshana-opticals-osms/projects](https://github.com/orgs/darshana-opticals-osms/projects)

---

## 4. Implemented Frontend Features

The frontend application has transitioned from its initial architectural scaffold into a comprehensive, fully tested operational client.

### Customer Portal (`CUSTOMER`)

- **Product Catalog & Filtering:** Real-time search by keyword, category tabs (Men, Women, Kids, Sunglasses), brand selection, and price range filters with loading, error, and empty-state handling.
- **Product Details & Gallery:** Detailed frame dimensions, material specifications, lens compatibility, and stock availability indicators.
- **Shopping Cart & Checkout:** Persistent client-side cart (`CartProvider`), line-item quantity controls, order summary calculation, shipping address entry, and order placement.
- **Online Payment Flow:** Integrated with PayHere payment gateway; handles payment initialization, secure form generation, return routing, and real-time status polling.
- **Appointment Booking:** Multi-step wizard to select branch location, available optometrist/doctor session, convenient time slot, and booking confirmation.
- **Optical Prescription History:** View-only access to customer clinical prescriptions issued during optical consultations, including refractive readings and notes.
- **Order Tracking:** Detailed historical order view with status badges (`ORDER_CREATED`, `PAYMENT_PENDING`, `COMPLETED`, `CANCELLED`), order line items, and payment revisit shortcuts.
- **Customer Loyalty Program:** Dedicated loyalty dashboard displaying accrued reward points, active tier benefits, and points earning/redemption activity.
- **AI Customer Assistant Widget:** Customer-scoped draggable launcher and floating chat drawer with Markdown rendering, suggested optical prompts, automatic session renewal, manual retry, and scoped chat history persistence.

### Optometrist Workspace (`OPTOMETRIST`)

- **Clinical Prescription Authoring (`/clinical/prescriptions/new`):** Specialized interface to capture refractive examination results:
  - Right Eye (OD) and Left Eye (OS) Sphere (SPH), Cylinder (CYL), Axis, and Near Addition (ADD).
  - Pupillary Distance (PD), recommended lens materials, frame recommendations, and clinical optometrist remarks.
  - Form validation with direct submission to backend electronic health records.

### Branch Assistant Workspace (`BRANCH_ASSISTANT`)

- **In-Store Order Management (`/staff/orders`):** View customer branch orders, inspect customer shipping/billing details, and update fulfillment progress.
- **Doctor Session Scheduling (`/staff/appointments/sessions/new`, `.../edit`):** Create and update doctor consultation sessions, set max patient capacity, and designate session room/hours.
- **Appointment Management & Rescheduling (`/staff/appointments`):** View scheduled patient bookings, check in arriving patients, and move/reschedule appointments across sessions.

### Branch Manager Workspace (`BRANCH_MANAGER`)

- **Inventory & Stock Management (`/staff/inventory`):** Real-time branch inventory overview, stock adjustment controls with optimistic concurrency handling, low-stock reorder thresholds, and inventory categorization.
- **Sales & Inventory Reports (`/staff/reports/sales`, `/staff/reports/inventory`):** Server-paginated, sortable tabular reports with multi-criteria filters and direct client-side CSV/PDF exports.
- **Staff Appointment Administration:** Oversight of all branch doctor sessions, booking volume, and staff allocations.
- **Loyalty Program Management (`/staff/loyalty`):** Review customer tier assignments and loyalty reward disbursements.

### System Administrator Portal (`SYSTEM_ADMIN`)

- **Executive Admin Dashboard (`/admin`):** High-level summary of organization-wide operations and quick-action links.
- **Staff Account Management (`/admin/staff`, `/admin/staff/new`):** Register and manage staff accounts (Branch Managers, Branch Assistants, Optometrists) with branch and role assignments.
- **Doctor Profile Management (`/admin/doctors`, `/admin/doctors/new`):** Maintain profiles of visiting ophthalmologists and optometrists, license credentials, contact info, and active practicing status.
- **Enterprise Inventory & Reporting (`/admin/inventory`, `/admin/reports/*`):** Cross-branch aggregate inventory visibility, supply chain replenishment alerts, and executive sales reports.

---

## 5. PayHere Hosted Payment Workflow & Testing Status

The frontend integrates with the Sri Lankan **PayHere Payment Gateway** to facilitate online payments for optical orders.

### Payment Execution Sequence

```
[ Customer Checkout ]
         │
         ▼
[ /payments/:orderId ] ──> Requests signed parameters from Backend API
         │
         ▼
[ PayHere Form Auto-Submit ] ──> Submits signed MD5 hash, order ID, amount (LKR)
         │                       to PayHere Sandbox (https://sandbox.payhere.lk/pay/checkout)
         ▼
[ PayHere Hosted Gateway ] ──> Customer enters payment details
         │
         ├─── (Async Server-to-Server Webhook) ───> Backend /api/payments/notify (IPN)
         │
         ▼
[ Redirect to Frontend ] ──> Return URL: /payments/return?order_id=...
         │                   Cancel URL: /payments/cancel?order_id=...
         ▼
[ /payments/result/:orderId ] ──> Polls paymentService to confirm authoritative payment status
```

### Verification & Testing Disclosure

- **Localhost Sandbox Testing:** Successfully verified end-to-end in the local development environment using PayHere Sandbox credentials, including payment initiation, mock card checkout, and return redirect handlers.
- **Hosted Production Environment Status:** The client-side form generation, MD5 payload handling, and return/cancel routing (`/payments/return`, `/payments/cancel`, `/payments/result/:orderId`) are fully implemented and deployed. However, **end-to-end payment confirmation on the hosted staging platform remains pending final live verification**, subject to external webhook (IPN) network routing between PayHere Sandbox and the hosted backend service.

---

## 6. Technology Stack & Architectural Principles

### Core Technologies

- **Library:** [React 18.3.1](https://react.dev/) (Functional components, React Hooks)
- **Build Tool & Dev Server:** [Vite 5.4 / 6.4](https://vitejs.dev/) with Fast Refresh
- **Routing:** [React Router DOM 6.26.2](https://reactrouter.com/) (Declarative client-side routing, protected role layouts)
- **Styling:** Modular Vanilla CSS with CSS custom properties (design tokens, responsive flexbox/grid, accessible contrast ratios)
- **Testing Framework:** [Vitest 5.0.5](https://vitest.dev/)
- **Testing Utilities:** [React Testing Library 16.0.1](https://testing-library.com/), `@testing-library/jest-dom 6.5.0`, `@testing-library/user-event 14.6.7`
- **Code Quality:** [ESLint 9.13](https://eslint.org/) (Flat config `eslint.config.js`), [Prettier 3.3.3](https://prettier.io/)

### Software Engineering Principles (Guideline §5.1)

- **SOLID Principles:** Single-responsibility components (UI split from network calls), open for extension (modular filter bars, dynamic table builders), dependency inversion via abstracted services.
- **DRY (Don’t Repeat Yourself):** Reusable design components (`Navbar`, `Footer`, `RoleSidebar`, `OrderShell`, `BranchSelect`, `AddToCartButton`) and shared utilities (`validators.js`, `apiClient.js`).
- **YAGNI (You Aren’t Gonna Need It):** Lean dependency footprint without unnecessary heavyweight UI frameworks; native CSS and minimal external dependencies.
- **Clean Code:** Standardized PascalCase components, camelCase functions/hooks, explicit error boundaries, and defensive API validation.

---

## 7. Project Directory Structure

```
frontend/
├── .github/
│   └── workflows/
│       └── frontend-ci.yml      # GitHub Actions CI pipeline (Node 24, Lint, Format, Test, Build)
├── .standards/
│   └── STANDARDS.md             # SENG 34213 coding and testing standards reference
├── coverage/                    # Generated test coverage reports (HTML, Clover, JSON)
├── docs/                        # Issue walkthroughs, manual test logs, PR specifications
├── public/                      # Static assets served directly
├── src/
│   ├── assets/                  # High-resolution optimized imagery, logos, banners
│   ├── components/
│   │   ├── admin/               # System Admin workspace widgets (staff/doctor editors)
│   │   ├── chatbot/             # AI Customer Assistant panel, launcher, message list
│   │   ├── common/              # Universal components (Navbar, Footer, Modal, Button)
│   │   ├── home/                # Homepage hero, category showcases, feature highlights
│   │   ├── orders/              # Order list items, address forms, status indicators
│   │   ├── prescriptions/       # Clinical prescription form, lens spec tables
│   │   ├── products/            # Product cards, catalog filters, price range sliders
│   │   └── reports/             # Report metrics cards, data tables, export buttons
│   ├── config/
│   │   ├── env.js               # Centralized environment variable accessor
│   │   └── roles.js             # Canonical user roles (CUSTOMER, SYSTEM_ADMIN, etc.)
│   ├── context/
│   │   └── CartContext.jsx      # Global shopping cart context and persistence provider
│   ├── hooks/                   # Custom reusable React hooks (e.g., useBranches)
│   ├── layouts/
│   │   ├── AppLayout.jsx        # Root application layout (Navbar + dynamic content + Footer)
│   │   ├── AdminLayout.jsx      # Sidebar-driven administrative layout
│   │   └── StaffLayout.jsx      # Staff workspace layout
│   ├── pages/                   # Route-level view components (45+ dedicated views)
│   ├── routes/
│   │   ├── AppRoutes.jsx        # Complete application route hierarchy and mappings
│   │   ├── ProtectedRoute.jsx   # Role-based route authorization guard
│   │   └── roleNavigation.js    # Post-login destination resolvers
│   ├── services/
│   │   ├── apiClient.js         # Unified Fetch client with JWT injection & error handling
│   │   ├── appointmentService.js# Appointment booking and optometrist session APIs
│   │   ├── auth/                # Authentication, token storage, and session lifecycles
│   │   ├── cartService.js       # Shopping cart synchronization
│   │   ├── chatbotService.js    # AI assistant messaging and session management
│   │   ├── inventoryService.js  # Inventory stock adjustments, thresholds, and alerts
│   │   ├── paymentService.js    # PayHere payload creation and verification
│   │   ├── productService.js    # Catalog queries, search, and category retrieval
│   │   └── reportService.js     # Sales and inventory reporting datasets
│   ├── styles/                  # Global stylesheets, color tokens, and utility classes
│   ├── utils/                   # Pure stateless helpers (formatters, validators, calculations)
│   ├── App.jsx                  # Root React component
│   └── main.jsx                 # Application entry point with BrowserRouter
├── tests/                       # 102 test files covering unit, component, and routing flows
├── .env.example                 # Environment variable template with safe placeholders
├── .gitignore                   # Git exclusion rules (node_modules, .env, dist, coverage)
├── .prettierrc                  # Prettier formatting rules
├── eslint.config.js             # ESLint 9 configuration with React and React Hooks plugins
├── index.html                   # HTML entry point with metadata and root element
├── package.json                 # Project dependencies, scripts, and package metadata
├── vercel.json                  # Vercel deployment configuration, rewrites, and security headers
└── vite.config.js               # Vite build configuration with React plugin and test runner setup
```

---

## 8. Prerequisites & Step-by-Step Installation

### Prerequisites

- **Node.js:** `v18.0.0` or higher (Active LTS `v20.x` or `v24.x` recommended; CI runs on Node 24)
- **Package Manager:** `npm` (`v9.x` or `v10.x`)
- **Git:** `v2.30.0` or higher

### Step 1: Clone the Repository

```bash
git clone https://github.com/darshana-opticals-osms/frontend.git
cd frontend
```

### Step 2: Switch to the Integration Branch

```bash
git checkout develop
```

### Step 3: Install Dependencies

Install all required runtime and development dependencies:

```bash
npm install
```

_(On fresh machines or CI environments, you can alternatively use `npm ci` to install directly from `package-lock.json`.)_

### Step 4: Configure Environment Variables

Copy the template environment configuration file:

```bash
# On Linux / macOS / Git Bash:
cp .env.example .env

# On Windows PowerShell:
Copy-Item .env.example .env
```

Open `.env` in your editor and configure the backend API endpoint:

```env
# Base URL for the OSMS backend REST API
VITE_API_BASE_URL=http://localhost:5000/api
```

> **Security Mandate:**  
> The `.env` file is strictly ignored by Git (`.gitignore`). Never commit active secrets, API keys, or production tokens into source control.

### Step 5: Start the Development Server

```bash
npm run dev
```

The application will start locally at **`http://localhost:5173`** with Fast Refresh enabled.

---

## 9. Available NPM Scripts

All development, verification, testing, and build operations are managed through standard npm scripts:

| Script                  | Command                 | Purpose                                                        |
| :---------------------- | :---------------------- | :------------------------------------------------------------- |
| `npm run dev`           | `vite`                  | Starts the Vite local development server with HMR              |
| `npm run build`         | `vite build`            | Compiles and optimizes assets into production bundle (`dist/`) |
| `npm run preview`       | `vite preview`          | Locally serves and previews the production build from `dist/`  |
| `npm test`              | `vitest run`            | Executes the complete automated test suite once                |
| `npm run test:watch`    | `vitest`                | Runs Vitest in interactive watch mode for TDD                  |
| `npm run test:coverage` | `vitest run --coverage` | Executes tests with V8 engine and produces coverage metrics    |
| `npm run lint`          | `eslint .`              | Runs ESLint 9 static analysis across all project files         |
| `npm run format`        | `prettier --write .`    | Formats all code according to project Prettier rules           |
| `npm run format:check`  | `prettier --check .`    | Verifies code formatting without modifying files (used in CI)  |

---

## 10. Testing Standards & Quality Gates

In compliance with Chapter 6 and Chapter 8 of the University Development Guideline, automated testing is treated as a mandatory engineering deliverable.

### 10.1 Test Structure & Conventions

- **Pattern:** All unit and component tests strictly follow the **Arrange-Act-Assert (AAA)** structure.
- **Naming Convention:** Test descriptions adopt the descriptive **Given-When-Then** specification format (e.g., `it('should display error message when required phone is missing')`).
- **Isolation:** Network requests, external API endpoints, and storage systems are cleanly mocked using Vitest mock utilities.

### 10.2 Test Execution Metrics

Running the full test suite produces:

- **Test Files:** `110 passed (110)`
- **Total Tests:** `1341 passed (1341)`
- **Failures / Errors:** `0`
- **Execution Time:** ~110 seconds across all component, service, and routing suites

### 10.3 Code Coverage Status (Guideline §6.4)

| Metric                            | Measured Achievement                 | University Guideline Minimum Gate | Status     |
| :-------------------------------- | :----------------------------------- | :-------------------------------- | :--------- |
| **Statement Coverage**            | **94.89%** (7,488 / 7,891 lines)     | ≥ 80% for all new code            | **PASSED** |
| **Branch / Conditional Coverage** | **86.00%** (1,530 / 1,779 branches)  | ≥ 80% standard                    | **PASSED** |
| **Function / Method Coverage**    | **91.27%** (303 / 332 methods)       | ≥ 80% standard                    | **PASSED** |
| **Element Coverage**              | **93.19%** (9,321 / 10,002 elements) | ≥ 80% standard                    | **PASSED** |

---

## 11. Continuous Integration & Vercel Deployment

### 11.1 Continuous Integration Pipeline (`frontend-ci.yml`)

Every push and pull request targeting `develop` or `main` triggers the automated GitHub Actions CI workflow:

```
[ Push / PR Event ]
         │
         ▼
[ 1. Checkout Repository ] ──────> actions/checkout@v4
         │
         ▼
[ 2. Environment Setup ] ────────> actions/setup-node@v4 (Node.js 24 + npm cache)
         │
         ▼
[ 3. Clean Install ] ────────────> npm ci (strictly verifies package-lock.json)
         │
         ▼
[ 4. Code Quality Gate ] ────────> npm run lint (zero errors allowed)
         │
         ▼
[ 5. Formatting Check ] ─────────> npm run format:check (Prettier validation)
         │
         ▼
[ 6. Automated Testing ] ────────> npm run test:coverage (1,341 tests + coverage report)
         │
         ▼
[ 7. Production Build ] ─────────> npm run build (validates Vite bundle generation)
```

### 11.2 Vercel Deployment Configuration (`vercel.json`)

The client application is deployed to **Vercel** configured for single-page routing and security:

- **SPA Rewrites:** All requests are rewritten to `/index.html` via `{"source": "/(.*)", "destination": "/index.html"}` to allow client-side React Router navigation.
- **Security Headers Injected at Edge:**
  - `X-Content-Type-Options: nosniff` (MIME-type sniffing prevention)
  - `X-Frame-Options: DENY` (Clickjacking mitigation)
  - `Referrer-Policy: strict-origin-when-cross-origin` (Information leakage protection)
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()` (Hardware feature containment)
  - `Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'`

---

## 12. Security & OWASP Top 10 Compliance

The frontend implements proactive mitigations adhering to Section 8.1 of the University Guideline:

| OWASP Risk ID | Category                                     | Frontend Engineering Mitigation                                                                                                                                                                                           |
| :------------ | :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A01:2021**  | **Broken Access Control**                    | Declarative route protection via `<ProtectedRoute allowedRoles={[...]} />`. Unauthenticated or unauthorized visitors are systematically redirected. Post-login routing resolves strictly to authorized subpaths.          |
| **A02:2021**  | **Cryptographic Failures**                   | Strict HTTPS enforcement on Vercel. Sensitive credentials (passwords, tokens) are never persisted in plaintext URL query strings or logged to console in production.                                                      |
| **A03:2021**  | **Injection & Cross-Site Scripting (XSS)**   | React JSX automatically encodes untrusted values before DOM injection. User-submitted inputs (such as chatbot queries, prescription values, and order notes) are validated using strict sanitization before transmission. |
| **A05:2021**  | **Security Misconfiguration**                | Hardened security headers defined in `vercel.json`. Vite build outputs are stripped of source maps in production to prevent source code reconstruction.                                                                   |
| **A06:2021**  | **Vulnerable & Outdated Components**         | Dependencies are scanned using `npm audit --audit-level=high` (0 high or critical vulnerabilities detected). Dependencies are pinned via `package-lock.json`.                                                             |
| **A07:2021**  | **Identification & Authentication Failures** | Clean JWT session handling. Access tokens expire and are cleared from memory and client storage upon expiration or explicit logout, preventing stale session reuse.                                                       |
| **A08:2021**  | **Software & Data Integrity Failures**       | Deterministic builds guaranteed via committed `package-lock.json` and `npm ci` in CI workflows.                                                                                                                           |

---

## 13. Git Workflow & Branch Strategy

The development team strictly follows the Git branching strategy and Conventional Commits defined in Chapter 3 of the University Guideline:

### Branching Model (§3.2)

- **`main`**: Production-ready code. Protected branch. Only merges via approved Pull Requests with passing CI checks. Tagged with Semantic Versioning (SemVer) upon releases.
- **`develop`**: Primary integration branch. All feature branches merge into `develop` through PRs.
- **`feature/<ticket-id>-<slug>`**: Short-lived feature branches created from `develop` (e.g., `feature/29-customer-chatbot-widget`).
- **`fix/<ticket-id>-<slug>`**: Bug fix branches created from `develop` (e.g., `fix/67-login-token-expiry`).
- **`docs/<slug>`**: Documentation updates and compliance branches created from `develop`.

### Commit Message Convention (§3.4)

All commits follow the Conventional Commits specification:

```
<type>(<scope>): <short summary>

[optional body explaining rationale and background context]

Closes #<issue-number>
Refs <SRS/SDS reference>
```

_Allowed types:_ `feat`, `fix`, `test`, `ci`, `build`, `perf`, `refactor`, `docs`, `chore`, `style`.

---

## 14. Known Limitations & Future Enhancements

In accordance with Section 9.2 (Item 4) of the University Development Guideline, the team maintains an open and transparent record of current limitations and future work:

1. **Hosted PayHere Payment Gateway Final Webhook Verification:**  
   While local Sandbox payment processing was completed and client redirection workflows are fully implemented, end-to-end hosted IPN completion via public webhooks on Render/Vercel remains pending final live verification during staged pre-demo testing.
2. **Bundle Code-Splitting Optimization:**  
   Vite currently outputs a single consolidated vendor chunk (~525 kB minified). Future refactoring will implement React dynamic `React.lazy()` / `Suspense` code-splitting across heavy administrative and reporting routes to optimize initial page load performance below 500 kB.
3. **Offline Mode & Service Worker Caching:**  
   The application currently requires active network connectivity. Future iterations will introduce Progressive Web App (PWA) service worker caching for product catalog offline browsing.

---

## 15. Contributors & Academic Acknowledgment

This project was developed by the **Darshana Opticals Software Engineering Team** for **SENG 34213: System Development Project**, University of Kelaniya, under the supervision of the Software Engineering Teaching Unit.

- **GitHub Organisation:** [https://github.com/darshana-opticals-osms](https://github.com/darshana-opticals-osms)
- **Frontend Repository:** [https://github.com/darshana-opticals-osms/frontend](https://github.com/darshana-opticals-osms/frontend)
