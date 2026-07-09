# Supabase — Scout OS

This directory holds the Supabase project configuration and the SQL that lives
**outside** of Prisma's control (Row Level Security policies, database
functions, triggers).

## Division of responsibility

| Concern                        | Owned by                                 |
| ------------------------------ | ---------------------------------------- |
| Table schema, columns, indexes | **Prisma** (`packages/database/prisma`)  |
| Auth, storage, realtime        | **Supabase**                             |
| RLS policies, DB functions     | **Supabase migrations** (this directory) |

Prisma connects to the same Postgres that Supabase provisions. We let Prisma
manage the DDL, and layer RLS on top so the anon/authenticated roles are still
tenant-isolated.

## Local development

```bash
# 1. Start the local Supabase stack (Docker required)
supabase start

# 2. Push the Prisma schema into the local DB
pnpm db:push

# 3. Apply the RLS policies
supabase db push        # or: psql < migrations/00000000000000_rls_policies.sql

# 4. Seed demo data
pnpm db:seed
```

## Applying to a hosted project

```bash
supabase link --project-ref <your-ref>
supabase db push
```

> The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Use it only in trusted server
> contexts (`src/lib/supabase/admin.ts`), never in the browser.
