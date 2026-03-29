# Vendor Administration SPA

Admin interface for managing vendor spend access per user, served at `/admin/vendors/`.

## Access

Requires the `finance_admin` role. Authenticated via Firebase with Google provider (shared session across all Haderach apps).

## Features

- **User list** — sortable, searchable table of platform users with `user`/`admin` roles, showing department assignments and vendor override counts
- **Vendor access editor** — per-user modal with three multi-select pickers:
  - **Departments** — grant access to all vendors in selected departments
  - **Included vendors** — grant access to individual vendors beyond department grants
  - **Denied vendors** — deny access to specific vendors (overrides department and inclusion grants)

## Access model

Resolution: **(vendors in allowed_departments UNION allowed_vendor_ids) MINUS denied_vendor_ids**

- Deny always wins (even over explicit includes)
- Vendors with no `department` are invisible unless explicitly included
- `finance_admin` users bypass all filtering in the vendors app

## Tech stack

- **React 19** + **Vite** (base path `/admin/vendors/`, build output `dist/admin/vendors/`)
- **Tailwind CSS** with app-specific color tokens in `src/index.css`
- **@haderach/shared-ui** — `AdminModal`, `MultiSelect`, `UserTable`, `TagBadge`, `agentFetch`, `GlobalNav`, auth primitives (`BaseAuthUser`, `fetchUserDoc`, `buildDisplayName`), RBAC helpers
- **Agent API** — all data flows through the agent service (`/agent/api/users`, `/agent/api/vendors`, `/agent/api/me`), no direct database access

## Development

```bash
npm install
npx vite --port 5176
```

Requires the agent service running locally on port 8080 (Vite proxies `/agent/api` requests). Set `VITE_AUTH_BYPASS=true` in `.env` to skip auth, or set it to `false` for real auth — a dev-only "Sign in with Google" button appears automatically in local dev (no redirect to haderach-home needed).

## Repository structure

```text
admin-vendors/
├── src/
│   ├── App.tsx               # Main view: user list with vendor access columns
│   ├── UserAccessModal.tsx   # Per-user vendor access editor modal
│   ├── api.ts                # API functions (uses agentFetch from shared-ui)
│   ├── auth/
│   │   ├── AuthGate.tsx      # Auth wrapper (requires finance_admin role)
│   │   ├── AuthUserContext.ts
│   │   ├── accessPolicy.ts
│   │   └── runtimeConfig.ts  # Firebase config loader
│   ├── index.css             # App color tokens
│   └── main.tsx
├── scripts/
│   ├── package-artifacts.sh  # Build artifact packaging
│   └── generate-manifest.mjs # Manifest generation for platform deploy
├── vite.config.ts
└── package.json
```

## Deployment

Follows the standard Haderach app delivery contract:

1. Merge to `main` triggers CI → artifact publish to GCS
2. Platform `deploy.yml` workflow promotes the artifact to Firebase Hosting
3. Artifact path: `gs://<bucket>/admin-vendors/versions/<commit-sha>/`
