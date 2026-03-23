<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# addressbook-api/

## Purpose
Personal addressbook/contact list management API. Provides CRUD operations for authenticated users to manage their contacts. Integrates with `UserInfoService` to enrich contact data with display names, avatars, and other profile fields.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/_twake/addressbook` | List all contacts in the user's addressbook |
| `POST` | `/_twake/addressbook` | Add one or more contacts |
| `GET` | `/_twake/addressbook/:id` | Get a specific contact by ID |
| `PUT` | `/_twake/addressbook/:id` | Update a contact (display_name, active status) |
| `DELETE` | `/_twake/addressbook` | Delete the entire addressbook |
| `DELETE` | `/_twake/addressbook/:id` | Delete a specific contact |

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Module export — instantiates router and registers routes |
| `routes/index.ts` | Express Router with all route definitions and middleware chains |
| `controllers/index.ts` | Request handlers for each endpoint |
| `middlewares/index.ts` | Validation middleware (ownership checks, input validation) |
| `services/index.ts` | `AddressbookService` — business logic and DB operations |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `routes/` | Route definitions |
| `controllers/` | Request handlers |
| `middlewares/` | Request validation and auth |
| `services/` | Business logic (AddressbookService singleton) |
| `tests/` | `controller.test.ts`, `middleware.test.ts`, `router.test.ts`, `service.test.ts` |

## For AI Agents

### Working In This Directory
- `AddressbookService` is a singleton — instantiated in `TwakeServer._initServer()` and passed as dependency
- Ownership validation: a user can only access/modify their own contacts
- Use Matrix authentication middleware from `utils/middlewares/auth.middleware.ts`

### Testing Requirements
```bash
npx nx run  @twake/tom-server:test -- --testPathPattern=addressbook
```

<!-- MANUAL: -->
