# Scout OS

> 사업 기회를 **먼저 발견**해주는 AI 직원.
> The AI employee that discovers business opportunities before you do.

Scout OS is not just an influencer search tool. It is an autonomous
business-development teammate. Its home screen is not a dashboard — it's
**"Today's Opportunities"**: a daily feed of creators, brands, and sellers worth
reaching out to. You save the good ones, decide what to do with them, and Scout
OS drafts the first message.

**Discover, not a dashboard, is the main entry point of Scout OS.**

See **[VISION.md](./VISION.md)** for the product philosophy and roadmap.

---

## 🔁 MVP Flow

The core loop the product delivers today — open it every morning and work down
the list:

```
  ┌──────────────┐   저장    ┌────────────┐   분류     ┌──────────────┐   생성    ┌──────────────┐
  │  /discover   │ ───────► │   /saved   │ ────────► │ 연락예정으로  │ ───────► │  /outreach   │
  │ 오늘의 기회   │          │ 상태·메모  │           │   상태 변경   │          │  DM 초안·복사 │
  └──────────────┘          └────────────┘           └──────────────┘          └──────┬───────┘
                                                                                        │ 복사
                                                                                        ▼
                                                                               실제 채널에서 연락
```

1. **`/discover`** 에서 오늘 발견한 기회를 확인한다. — "Today's Opportunities"
2. 마음에 드는 기회를 **저장**한다. — 카드의 `저장` 버튼 → `/saved`로 모임
3. **`/saved`** 에서 상태를 분류한다. — `미검토 · 관심 · 보류 · 제외 · 연락예정` + 메모
4. **연락예정**으로 바꾼다. — 연락할 대상만 추린다
5. **`/outreach`** 에서 DM 초안을 생성한다. — 연락예정 항목만 모여 유형별 mock DM 생성
6. **복사**해서 실제 채널에서 연락한다. — DM을 클립보드로 복사

> 저장·상태·메모·DM 초안은 모두 **localStorage**에 유지되어 새로고침 후에도 남습니다.

### Screens

| Route               | 화면                  | 역할                                                         |
| ------------------- | --------------------- | ------------------------------------------------------------ |
| `/discover`         | Today's Opportunities | **메인**. 오늘 발견한 기회를 카테고리별로 보여주는 일일 피드 |
| `/search`           | Search                | 사람을 설명하면 기회를 찾아주는 검색 경험 (2번째 탭)         |
| `/saved`            | 저장한 기회           | 저장한 기회를 상태/메모로 분류하고 필터링                    |
| `/outreach`         | 연락 준비             | `연락예정` 기회만 모아 DM 초안 생성·복사                     |
| `/login`, `/signup` | 인증                  | Supabase Auth (이메일/비밀번호) — 연결 준비 완료             |
| `/dashboard`        | —                     | **`/discover`로 리다이렉트** (대시보드 대신 Discover가 메인) |

로그인 후 첫 화면은 **`/discover`** 입니다.

---

## 🟢 Current status (MVP prototype)

Scout OS is at the **working-UX prototype** stage. The end-to-end flow above is
fully clickable, but it deliberately runs on **mock data + localStorage** — no
external services are wired yet.

| Area                                            | Status                                                  |
| ----------------------------------------------- | ------------------------------------------------------- |
| Discover / Search / Saved / Outreach UX         | ✅ Built, mock data                                     |
| Save · status · memo · DM draft persistence     | ✅ localStorage (survives refresh)                      |
| DM draft generation                             | ✅ Deterministic template (type-aware), **no AI API**   |
| Supabase Auth (`/login`, `/signup`)             | ✅ Wired, works with real keys                          |
| Real discovery / search engine                  | ⛔ Not connected (mock only)                            |
| Prisma + Supabase Postgres                      | 🟡 Schema + client scaffolded, not used by the MVP flow |
| AI analysis · AI DM · CRM pipeline · follow-ups | ⛔ Scaffolded, not yet wired                            |

> The MVP intentionally proves the **flow and the feel** first. Persistence,
> real sourcing, and real AI are the next phases (see the roadmap in VISION.md).

---

## ✨ Full capability set (the vision)

The MVP realizes a slice of this; the rest is the roadmap.

1. **Creator discovery** — Instagram, YouTube, TikTok, blogs
2. **Emerging brand discovery**
3. **Influencers running their own brands**
4. **Group-buy / shopping-mall seller discovery**
5. **Micro-creator discovery**
6. **Attribute-based people search** ("find people who…")
7. **AI analysis** — fit, audience, risk, opportunity scoring
8. **Automated collaboration management (CRM)**
9. **AI DM generation**
10. **AI follow-ups**
11. **Collaboration pipeline tracking**

---

## 🧱 Tech stack

| Layer        | Choice                                            |
| ------------ | ------------------------------------------------- |
| Framework    | **Next.js** (App Router) + **TypeScript**         |
| Styling      | **Tailwind CSS** + **shadcn/ui**                  |
| Data / Auth  | **Supabase** (Postgres, Auth, Storage)            |
| ORM          | **Prisma**                                        |
| Server state | **React Query** (TanStack Query)                  |
| Validation   | **Zod**                                           |
| Tooling      | **Turborepo**, **pnpm**, **ESLint**, **Prettier** |

---

## 📁 Repository structure

A **Turborepo + pnpm** monorepo. The app follows a **feature-based** layout so
each capability owns its schemas, hooks, and components.

```
scout-os/
├── apps/
│   └── web/                        # Next.js application
│       └── src/
│           ├── app/                # App Router
│           │   ├── discover/       #   ★ main — Today's Opportunities
│           │   ├── search/         #   search experience
│           │   ├── saved/          #   saved + classification
│           │   ├── outreach/       #   DM drafts
│           │   ├── (auth)/         #   login / signup
│           │   ├── (dashboard)/    #   deeper scaffolds (/dashboard → /discover)
│           │   └── api/            #   route handlers (for the DB-backed scaffolds)
│           ├── components/         # Shared UI (ui/ = shadcn, layout/ = shell + AppTopbar)
│           ├── features/           # ★ Feature modules (the heart of the app)
│           │   ├── search/         #   ← the MVP lives here: discover · search · saved · outreach
│           │   ├── auth/           #   Supabase email/password auth
│           │   ├── discovery/      #   (scaffold) Prisma-backed creator discovery
│           │   ├── analysis/       #   (scaffold) AI fit scoring
│           │   ├── crm/            #   (scaffold) collaboration pipeline
│           │   └── outreach/       #   (scaffold) deal-based AI DM + follow-ups
│           ├── hooks/              # Cross-feature React hooks
│           ├── lib/                # env, utils, supabase, api, auth, query-keys
│           ├── providers/          # React Query, theme, composed AppProviders
│           ├── services/           # Cross-cutting services (AI provider layer)
│           └── types/              # Shared TypeScript types
├── packages/
│   ├── database/                   # Prisma schema, client singleton, seed
│   └── config/                     # Shared ESLint / TS / Tailwind presets
├── supabase/                       # Supabase config + RLS policies
├── .env.example
├── turbo.json
└── pnpm-workspace.yaml
```

> **Where the MVP lives:** the entire clickable flow (discover → save → classify
> → outreach) is implemented in **`features/search`** on mock data + localStorage.
> The `discovery / analysis / crm / outreach` feature folders are the deeper,
> Prisma-backed scaffolds that the flow will graduate onto in later phases.

> **Why features live inside `apps/web/src`:** the folders you'd normally see at
> a project root (`components/`, `lib/`, `hooks/`, `services/`, `providers/`,
> `types/`) are colocated with the app that owns them. Truly shared code is
> promoted into `packages/` (e.g. `packages/database`).

---

## 🚀 Getting started

### Prerequisites

- **Node.js ≥ 20** (`.nvmrc` pins 20)
- **pnpm ≥ 9** (`corepack enable`, or `npm i -g pnpm`)
- A **Supabase** project is optional for the MVP flow (it runs on mock data);
  it's only needed to exercise `/login`, `/signup`, and the DB-backed scaffolds.

### 1. Install

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example apps/web/.env
# The MVP flow renders with placeholder values. Fill in real Supabase keys to
# use auth, and DATABASE_URL / AI keys to exercise the DB-backed scaffolds.
```

### 3. (Optional) Set up the database

Only needed for the Prisma-backed scaffolds — the MVP flow does not require it.

```bash
pnpm db:generate      # generate the Prisma client
pnpm db:push          # push the schema to Postgres
pnpm db:seed          # seed demo workspace + creators
```

Then apply Row Level Security (see [`supabase/README.md`](./supabase/README.md)).

### 4. Run

```bash
pnpm dev              # http://localhost:3000  → redirects to /discover
```

Open **http://localhost:3000/discover** and walk the MVP flow above.

---

## 🛠️ Scripts

| Command           | Description                      |
| ----------------- | -------------------------------- |
| `pnpm dev`        | Run all apps in dev mode (Turbo) |
| `pnpm build`      | Build everything                 |
| `pnpm lint`       | Lint all packages                |
| `pnpm typecheck`  | Type-check all packages          |
| `pnpm format`     | Prettier write                   |
| `pnpm db:studio`  | Open Prisma Studio               |
| `pnpm db:migrate` | Create/apply a dev migration     |
| `pnpm db:seed`    | Seed demo data                   |

---

## 🚀 Deployment (GitHub → Vercel)

The MVP flow runs on mock data + localStorage, so it deploys without any real
backend — but env vars must be **present and well-formed** (validated at boot).

### 1. Push to GitHub

```bash
git add -A
git commit -m "chore: Scout OS MVP — discover → save → classify → outreach"
git branch -M main
git remote add origin https://github.com/<you>/scout-os.git
git push -u origin main
```

`.env` files are git-ignored (`apps/web/.env`, `.env`, `.env.local`) — only
`.env.example` is committed. Verify before pushing:

```bash
git status --short          # no .env files should appear
git ls-files | grep .env    # should show only ".env.example"
```

### 2. Import into Vercel

Create a new Vercel project from the GitHub repo, then set:

| Setting              | Value                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------ |
| **Framework Preset** | Next.js                                                                                    |
| **Root Directory**   | `apps/web`                                                                                 |
| **Install Command**  | `pnpm install` _(default — runs Prisma generate via the database package's `postinstall`)_ |
| **Build Command**    | `next build` _(default — leave as-is)_                                                     |
| **Output Directory** | `.next` _(default — leave as-is)_                                                          |
| **Node.js Version**  | `20.x`                                                                                     |

> The monorepo's workspace packages resolve automatically because Vercel installs
> from the pnpm workspace root. `prisma generate` runs during `pnpm install`, so
> the default `next build` works without a custom build command.

### 3. Vercel environment variables

Add these in **Project → Settings → Environment Variables** (Production +
Preview). See `.env.example` for the full annotated list.

| Variable                                   | Required? | Notes                                                |
| ------------------------------------------ | --------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                 | ✅ yes    | Must be a valid URL. Real value enables auth.        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`            | ✅ yes    | Non-empty.                                           |
| `SUPABASE_SERVICE_ROLE_KEY`                | ✅ yes    | Non-empty, server-only. **Never** `NEXT_PUBLIC`.     |
| `DATABASE_URL`                             | ✅ yes    | Must be a valid `postgresql://` URL.                 |
| `NEXT_PUBLIC_APP_URL`                      | ✅ yes    | Your Vercel URL, e.g. `https://scout-os.vercel.app`. |
| `NEXT_PUBLIC_APP_NAME`                     | optional  | Defaults to "Scout OS".                              |
| `DIRECT_URL`                               | optional  | For Prisma migrations.                               |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`     | optional  | Only for future real-AI features.                    |
| `AI_DEFAULT_PROVIDER` / `AI_DEFAULT_MODEL` | optional  | Have defaults.                                       |
| `CRON_SECRET`                              | optional  | For future cron endpoints.                           |

> **MVP-only deploy:** the flow works with placeholder-but-valid values for the
> Supabase/DB vars (a valid URL + any non-empty string). **Real auth** requires a
> real Supabase project (next step).

### 4. Connect Supabase (when you want real auth / persistence)

1. Create a project at [supabase.com](https://supabase.com).
2. **Settings → API** → copy the Project URL, `anon` key, and `service_role` key
   into the matching Vercel env vars.
3. **Settings → Database** → copy the pooled + direct connection strings into
   `DATABASE_URL` / `DIRECT_URL`.
4. **Auth → URL Configuration** → set Site URL to your Vercel domain and add
   `https://<your-domain>/auth/callback` as a redirect URL.
5. (Optional, for the DB scaffolds) push the schema and RLS:
   ```bash
   pnpm db:push
   # then apply supabase/migrations/*.sql  (see supabase/README.md)
   ```

---

## 💻 Continue on another computer

```bash
git clone https://github.com/<you>/scout-os.git
cd scout-os
pnpm install                      # generates the Prisma client automatically
cp .env.example apps/web/.env     # paste the same values you use on Vercel
pnpm dev                          # http://localhost:3000 → /discover
```

- **Prerequisites:** Node ≥ 20, pnpm ≥ 9 (`corepack enable` or `npm i -g pnpm`).
- **Env vars** aren't in git — copy them from Vercel (Settings → Environment
  Variables → "Copy" / `vercel env pull apps/web/.env`) or your password manager.
- **Saved opportunities / DM drafts live in the browser's localStorage**, so they
  don't sync between machines yet — that's expected until Phase 2 moves the
  persistence seam to Supabase.

---

## 🧭 Architectural conventions

- **Feature-first.** New capability → new folder in `features/`. Don't scatter
  its files across global folders.
- **Design-system reuse.** Opportunity cards share one presentational core
  (`OpportunityBody`) across Discover, Search, and Saved so every screen reads
  as one system.
- **localStorage as the MVP store.** Saved opportunities (`scout:saved-opportunities`)
  and DM drafts (`scout:dm-drafts`) persist client-side and broadcast changes so
  cards, the top-bar counts, and pages stay in sync. This is the seam that later
  swaps to Supabase without touching the UI.
- **Zod is the contract.** API boundaries validate input with a Zod schema from
  the feature's `schemas.ts`.
- **`server-only` services.** Files that touch Prisma or secrets import
  `server-only` and are never re-exported from a feature barrel.
- **Tenant isolation (DB-backed scaffolds).** Data access is scoped by
  `workspaceId` and enforced again at the database with RLS.

---

## 📄 License

Proprietary — © Scout OS. All rights reserved.
