# Vendor Administration — Architecture

## Overview

Single-page admin app for managing per-user vendor spend access (departments, vendor includes/denies), served at `/admin/vendors/`. No backend service — all data flows through the shared agent service API (`/agent/api/`).

```
Browser
  │
  ├── GET /admin/vendors/*  ──►  Firebase Hosting (static SPA)
  │
  └── /agent/api/*  ────────►  Firebase Hosting rewrite
                                   │
                                   ▼
                              Cloud Run (agent-api, FastAPI)
                                   │
                                   ▼
                              Cloud SQL Postgres (users, vendors, departments)
```

## Ownership boundaries

| Concern | Owner |
|---------|-------|
| SPA frontend, CI, artifact publish | This repo (`admin-vendors`) |
| Shared UI components (AppRail, UserTable, AdminModal, MultiSelect, TagBadge, FeedbackPopover, primitives) | `haderach-home` (`@haderach/shared-ui`) |
| Auth primitives (BaseAuthUser, fetchUserDoc, buildDisplayName, RBAC helpers) | `haderach-home` (`@haderach/shared-ui`) |
| Agent API endpoints (`/users`, `/vendors`, `/me`) | `agent` repo |
| Firebase Hosting config, routing rewrites, deploy orchestration | `haderach-platform` |

## Repo layout

```
admin-vendors/
├── src/
│   ├── auth/
│   │   ├── accessPolicy.ts      # RBAC (re-exports from @haderach/shared-ui)
│   │   ├── AuthGate.tsx          # Auth gate (requires finance_admin role)
│   │   ├── AuthUserContext.ts    # React context (AuthUser = BaseAuthUser)
│   │   └── runtimeConfig.ts     # Firebase config from VITE_* env vars
│   ├── App.tsx                   # Root: AppRail + user list + modal
│   ├── UserAccessModal.tsx       # Per-user vendor access editor modal
│   ├── api.ts                    # API functions (agentFetch → /agent/api/users, /vendors)
│   ├── index.css                 # App color tokens
│   ├── main.tsx
│   └── vite-env.d.ts
├── scripts/
│   ├── package-artifacts.sh      # Tar dist/ + checksums
│   └── generate-manifest.mjs    # Produce manifest.json for platform contract
├── docs/
│   └── architecture.md           # This file
├── .cursor/
│   └── rules/
│       ├── architecture-pointer.mdc
│       ├── branch-safety-reminder.mdc
│       ├── cross-repo-status.mdc
│       ├── pr-conventions.mdc
│       ├── repo-hygiene.mdc
│       ├── service-oriented-data-access.mdc
│       └── todo-conventions.mdc
├── .github/
│   ├── pull_request_template.md
│   └── workflows/
│       ├── ci.yml                # PR checks (lint + build)
│       └── publish-artifact.yml  # Build, package, upload to GCS on push to main
├── .env.example
├── .gitignore
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts                # base: /admin/vendors/, proxy for local dev
└── README.md
```

## Routing

| Path | Target | Notes |
|------|--------|-------|
| `/admin/vendors/*` | Firebase Hosting → SPA `index.html` | Client-side routing |
| `/agent/api/**` | Firebase Hosting rewrite → Cloud Run `agent-api` | Shared agent service |

## Access model

This app manages vendor spend access for users with `user` or `admin` roles. Only users with the `finance_admin` role can access this app.

### Vendor access resolution

A user's effective vendor set is computed as:

**(vendors in allowed_departments UNION allowed_vendor_ids) MINUS denied_vendor_ids**

- Deny always wins (even over explicit includes)
- Vendors with no `department` field are invisible unless explicitly included
- `finance_admin` users bypass all filtering in the vendors app (full access)

### User doc fields managed by this app

| Field | Type | Purpose |
|-------|------|---------|
| `allowedDepartments` | `string[]` | Department-level vendor grants |
| `allowedVendorIds` | `string[]` | Per-vendor inclusion overrides |
| `deniedVendorIds` | `string[]` | Per-vendor denial overrides |

## UI architecture

The SPA uses shared components from `@haderach/shared-ui` (consumed via `file:` protocol from `../haderach-home/packages/shared-ui`):

- **AppRail** — collapsible left rail for domain navigation with feedback popover and user avatar flyout. Replaces the legacy GlobalNav.
- **UserTable** — user list table with column definitions, sorting, type-ahead search.
- **AdminModal** — modal shell used by `UserAccessModal`.
- **MultiSelect** — searchable multi-select popover for departments and vendor pickers.
- **TagBadge** — styled pill for department badges.
- **Button** — shadcn button used in save actions.

Layout hierarchy (in `App.tsx`):

```
.flex.h-screen
├── AppRail (left rail)
└── main.flex-1 (overflow-y-auto)
    └── .max-w-5xl (centered)
        └── UserTable (sortable, searchable)
            ├── Columns: Email, Name, Departments, Vendor Access
            └── Row click → UserAccessModal
```

The user list filters to show only users with `user` or `admin` roles (the population that has vendor access). `finance_admin` users show "All" for departments and vendor access columns.

The `UserAccessModal` provides three `MultiSelect` pickers:
1. **Departments** — grant access to all vendors in selected departments
2. **Included Vendors** — grant access to individual vendors beyond department grants
3. **Denied Vendors** — deny access to specific vendors (overrides all grants)

## API contract

All API calls go through `agentFetch` from `@haderach/shared-ui`, which prepends `/agent/api` and attaches Firebase ID tokens.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/users` | `GET` | List all platform users (with spend access fields) |
| `/users/{email}` | `PATCH` | Update user's vendor access (departments, includes, denies) |
| `/vendors` | `GET` | List all vendors (for populating MultiSelect pickers) |
| `/me` | `GET` | Fetch authenticated user's roles and profile (via shared `fetchUserDoc`) |

## Authentication

Authentication is centralized at the platform level. This app does not handle sign-in directly.

- **Sign-in (production):** If no Firebase Auth session exists, the app redirects to `/?returnTo=/admin/vendors/`.
- **Sign-in (local dev):** When `import.meta.env.DEV` is true and no session exists, the app shows a dev-only "Sign in with Google" button instead of redirecting, allowing authentication directly on the app's origin.
- **Authorization:** Role-based access control (RBAC). User roles are resolved at runtime via `fetchUserDoc` (from `@haderach/shared-ui`), which calls `GET /agent/api/me`. Access is granted if the user holds the `finance_admin` role (`APP_GRANTING_ROLES['vendor_administration']`).
- Auth primitives (`BaseAuthUser`, `fetchUserDoc`, `buildDisplayName`) and RBAC helpers (`APP_CATALOG`, `APP_GRANTING_ROLES`, `hasAppAccess`, `getAccessibleApps`) are imported from `@haderach/shared-ui` — this app does not maintain local copies. `AuthUser` re-exports `BaseAuthUser` directly (no app-specific extensions).
- **Unauthorized:** Access-denied screen with sign-out option.
- **Bypass:** `VITE_AUTH_BYPASS=true` or `?authBypass=1` query param skips auth (local dev).
- **Persistence:** `browserLocalPersistence` — sessions survive tab close (shared across all apps on `haderach.ai` via same-origin IndexedDB).
- **Fail-closed:** If the agent API is unreachable, roles resolve to empty and access is denied.

Config is read from `VITE_FIREBASE_*` env vars at build time (see `.env.example`).

## Build and deploy flow

1. `npm run build` → `dist/admin/vendors/` (Vite output)
2. Package as `runtime.tar.gz` via `scripts/package-artifacts.sh`
3. Generate `manifest.json` via `scripts/generate-manifest.mjs`
4. Upload to `gs://<bucket>/admin-vendors/versions/<commit-sha>/`
5. Platform downloads, verifies, extracts into `hosting/public/admin/vendors/`
6. `firebase deploy --only hosting`

## Local development

```bash
npm install
npx vite --port 5176
```

Requires the agent service running locally on port 8080 (Vite proxies `/agent/api` requests). The dev server also proxies `/assets/` requests to the haderach-home dev server and redirects `/` to the home app for platform sign-in flow.

Set `VITE_AUTH_BYPASS=true` in `.env` for UI-only development without auth. Set to `false` for real auth — the dev-only Google sign-in button appears automatically.

## Security

- Default `noindex, nofollow, noarchive` on SPA and Firebase Hosting responses
- No direct database access — all data through authenticated agent API
- Firebase Auth gate restricts SPA access to users with `finance_admin` role
- `AuthGate` is local to this app (not from shared-ui)
- Sensitive vendor access changes are auditable through the agent API

## Deferred

- E2E tests
