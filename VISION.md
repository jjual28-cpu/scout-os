# Scout OS — Vision

## The one-line thesis

> **Scout OS는 사업 기회를 먼저 발견해주는 AI 직원입니다.**
> Scout OS is an AI employee that discovers business opportunities before you do.

Most tools wait for you to search. Scout OS works while you sleep — proactively
surfacing the creators, brands, and sellers you should be talking to, and then
carrying the relationship forward until it becomes a deal.

**The home screen is not a dashboard. It's "Today's Opportunities."**

---

## Why now

Discovery today is broken into disconnected, manual steps:

1. Someone hunts for influencers in a spreadsheet.
2. Someone else eyeballs their fit and audience.
3. A third person writes DMs one by one.
4. Follow-ups fall through the cracks.
5. Nobody has a single view of what's in progress.

Every step is human, slow, and lossy. Meanwhile the best opportunities —
a micro-creator about to blow up, a new brand looking for partners, a group-buy
seller with a hungry audience — appear and disappear before anyone notices.

**Scout OS collapses those steps into one continuous loop, opened every morning.**

---

## Where we are today — the MVP

The current product proves the **flow and the feel** end to end. It runs on mock
data and localStorage (no external services yet), but the daily loop is real and
clickable:

```
  /discover  →  저장  →  /saved  →  연락예정  →  /outreach  →  복사 → 실제 채널
  오늘의 기회    save     상태·메모   상태 변경     DM 초안       copy
```

1. **`/discover` — Today's Opportunities.** Open it every morning. AI-surfaced
   opportunities, grouped by category (신규 브랜드 · 성장중인 마이크로 크리에이터 ·
   자체 브랜드 운영자 · 공구 셀러 · 니치 크리에이터), each with a discovery reason
   and an opportunity score.
2. **Save** the ones worth pursuing.
3. **`/saved` — classify.** Tag each with a status (미검토 · 관심 · 보류 · 제외 ·
   연락예정) and a private note, then filter by status.
4. **Mark 연락예정** — narrow down to who you'll actually contact.
5. **`/outreach` — draft.** The 연락예정 set gets a warm, non-salesy DM draft,
   worded differently per opportunity type.
6. **Copy** it and send from your real channel.

Everything persists across refreshes. **Discover — not a dashboard — is the main
entry point**; `/dashboard` redirects to `/discover`, and search is the second
tab, not the front door.

The point of this stage: make a screen people **want to open every day**.

---

## The product as an "AI employee"

We frame Scout OS not as a dashboard but as a **teammate** with a job:

| A human BD hire would…                     | Scout OS does…                                       |
| ------------------------------------------ | ---------------------------------------------------- |
| Flag "here's who you should talk to today" | **Today's Opportunities** (the home screen)          |
| Research prospects across platforms        | **Discovery** across IG / YouTube / TikTok / blog    |
| Judge whether they're a good fit           | **Save + classify** (today) → **AI analysis** (next) |
| Draft the first outreach message           | **DM draft generation**                              |
| Chase people who didn't reply              | **AI follow-ups** (next)                             |
| Keep the deal board up to date             | **CRM pipeline** (next)                              |

The north star: a founder or marketer opens Scout OS in the morning and finds
**qualified opportunities already surfaced and drafted** — not a blank search box.

---

## Who it's for

- **DTC brands & marketers** running creator/influencer collaborations.
- **Agencies** managing outreach at scale across many clients.
- **Sellers & group-buy operators** looking for the right partners.
- **Creators-turned-founders** finding peers and cross-promotion.

---

## The full loop (where this is heading)

The MVP realizes the left half; the right half is the roadmap. Every pass makes
the next one smarter.

```
        ┌────────────┐
        │  DISCOVER  │  Today's Opportunities — the daily feed (✅ MVP)
        └─────┬──────┘
              ▼
        ┌────────────┐
        │  JUDGE     │  save · status · note (✅ MVP) → AI analysis (next)
        └─────┬──────┘
              ▼
        ┌────────────┐
        │  OUTREACH  │  DM draft + copy (✅ MVP) → send + AI follow-ups (next)
        └─────┬──────┘
              ▼
        ┌────────────┐
        │   MANAGE   │  CRM pipeline tracks every collaboration (next)
        └─────┬──────┘
              │
              └──────────►  outcomes feed back into better discovery
```

---

## What makes it different

1. **Proactive, not reactive.** The default state is "here are today's
   opportunities," not "type a query."
2. **Whole-funnel, not point-solution.** Discovery, judgement, and outreach live
   in one flow, so context is never lost between steps.
3. **Beyond influencers.** Brands, sellers, and self-branded creators are
   first-class citizens — modeled polymorphically so new entity types slot in.
4. **AI as a coworker.** It surfaces, it drafts — with a human in the loop for
   approval, not data entry.

---

## Design principles (engineering)

- **Feature-based architecture.** Every capability is a vertical slice that can
  evolve — and eventually graduate into its own package or service.
- **One design system.** Opportunity cards share a single presentational core
  across Discover, Search, and Saved.
- **A clean persistence seam.** The MVP stores saved opportunities and DM drafts
  in localStorage behind hooks; swapping that seam to Supabase later won't touch
  the UI.
- **Provider-agnostic AI.** The `services/ai` layer hides the model behind an
  interface, so DM generation and analysis can route per-task to the best model.
- **Schema-first.** Zod schemas are the contract between client, server, and DB.
- **Multi-tenant from day one.** DB-backed data is workspace-scoped and RLS-guarded.

---

## Roadmap

### Phase 1 — The daily loop _(✅ done — current MVP)_

- **Discover-first home** ("Today's Opportunities"), search, save, classify,
  and DM-draft-and-copy — a complete, clickable flow on mock data + localStorage.

### Phase 2 — Make it real & persistent

- Move saved opportunities / status / notes / drafts from localStorage to
  **Supabase** (behind the same hooks). Real auth-gated workspaces.

### Phase 3 — Real discovery

- Platform connectors + enrichment so `/discover` is populated by real signals,
  not mock data. Saved searches that re-run and surface fresh matches daily.

### Phase 4 — Real intelligence

- Live **AI analysis** (fit / audience / risk) and **AI DM generation** replacing
  the deterministic template, with a human still in the approval loop.

### Phase 5 — Outreach & pipeline

- Channel integrations to **send** DMs/emails, **AI follow-ups** with reply
  detection, and a **CRM pipeline** that tracks every collaboration to close.

### Phase 6 — The autonomous scout

- A morning digest of "opportunities for you," self-improving from which types,
  niches, and angles actually convert.

---

## The measure of success

Scout OS is working when a user stops _searching_ for opportunities —
because every morning the opportunities are already waiting on `/discover`.
