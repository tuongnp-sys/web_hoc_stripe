# Admin Dashboard & RBAC

## Roles & scopes

| Field | Values | Meaning |
|-------|--------|---------|
| `role` | `user`, `admin` | Only `admin` can open `/admin` |
| `admin_scope` | `none`, `view`, `edit`, `full` | Delegated permissions when `role=admin` |
| `account_status` | `active`, `suspended` | Suspended users cannot log in; active JWTs are rejected on the next API call (reversible) |
| `is_root` | boolean | `admin@localhost` — cannot demote, suspend, or delete |

## Permission matrix

| Action | view | edit | full |
|--------|:----:|:----:|:----:|
| View lists & details | yes | yes | yes |
| Edit users, gold, products | no | yes | yes |
| Suspend / restore accounts | no | yes | yes |
| Create users, change role/scope | no | no | yes |
| Permanent delete (⋯ menu) | no | no | yes |

## API

- `GET /api/admin/session` — actor + capabilities
- `GET/POST/PATCH/DELETE /api/admin/users`

## Dev root admin

- Email: `admin@localhost`
- Password: `admin123456`
- Scope: `full`, `is_root: true`

## Suspended accounts

- New login (email or OAuth) returns `403` with `code: ACCOUNT_SUSPENDED`.
- Any authenticated request (`requireAuth`) re-checks `account_status` from the database.
- The frontend clears the token and redirects to `/login?error=account_suspended` with an English notice.

## Smoke test

```bash
cd backend
npm run smoke:admin
```
