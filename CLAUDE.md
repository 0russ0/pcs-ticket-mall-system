@AGENTS.md

# Bulldog Bank — project context

Student rewards platform for **Provident Charter School** (Pittsburgh, PA). Students earn
points from staff, spend them in a store, and compete in house/team standings. Formerly
called "PCS Ticket Mall System" — the repo, package name, and Vercel URL still use the old
name, but **all user-facing copy says "PCS Bulldog Bank"**.

- Repo: `github.com/0russ0/pcs-ticket-mall-system` (branch: `main`, deploys on push)
- Production: `https://pcs-ticket-mall-system.vercel.app`
- Primary user: Russ Loyd (`russ@phusiongroup.com`), admin — non-engineer stakeholder who
  describes features in plain language and expects working software, not code review.

## Stack

Next.js 15 (App Router) · React 19 · Tailwind v4 · TypeScript · Prisma 5 · Neon serverless
Postgres · NextAuth v5 beta (Google OAuth, JWT sessions) · Resend (email) · Vercel Blob
(image uploads) · Vercel cron.

Env vars (see `.env` / `.env.local`): `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_GOOGLE_DOMAIN`, `RESEND_API_KEY`,
`CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID`.

## Hard rules (each of these came from a real incident)

1. **Never add per-request DB queries to the `jwt()` callback in `auth.ts`.** Middleware
   runs on Vercel's Edge Runtime, where Prisma is not reliably supported. Doing this took
   production login down completely (admins spinning forever, power users bounced back to
   Google). The accepted tradeoff: a staff role change requires that person to sign out and
   back in. Leave it that way.

2. **Use `npx prisma db push`, never `prisma migrate dev`.** Migrations fail against Neon's
   shadow-database setup. There is no migrations directory.

3. **`schoolId = 1` ("PCS Central") is the real school.** ~302 real students, `externalId`
   values like `10254`. `schoolId = 2` ("PCS West") is leftover demo/seed data — 225
   synthetic students with `externalId` like `RI0001` and zero staff. Every production data
   operation must be scoped to `schoolId: 1`. Never mix or clean up school 2 without asking.

4. **Leaderboards always rank on `lifetimePoints`, never `totalPoints`.** `totalPoints` is
   the spendable balance and drops when a student orders; `lifetimePoints` never decreases.
   Ranking on the balance made leaderboards fall when kids spent points.

5. **Products can never be hard-deleted** once they have `OrderItem` history (FK
   constraint). Soft-delete with `isActive: false`.

6. **Verify before every push:** `npx tsc --noEmit`, then `npm run build`. Both must be
   clean. Do not push on a red build.

## Domain model

**Points.** `Student.totalPoints` = spendable balance (deducted at order *submission*, not
pickup, inside a transaction; refunded on cancellation). `Student.lifetimePoints` = earned
total, never decreases.

**Houses / teams.** Four houses, defined with their brand colors in `lib/leaderboard.ts`:

| House | Color | Asset slug |
|---|---|---|
| Rachel Carson House | `#10B981` green | `rachel-carson` |
| Clemente House | `#FBBF24` yellow | `clemente` |
| Hot Metal House | `#EF4444` red | `hot-metal` |
| Liberty House | `#3B82F6` blue | `liberty` |

Logos and circular badges live in `public/houses/{slug}-logo.png` and `-badge.png`, resolved
through `lib/houseLogos.ts`. (Hot Metal = red and Clemente = yellow was a deliberate swap;
don't "fix" it.)

**House totals are computed live**, never stored: `getTeamSummaries()` in
`lib/leaderboard.ts` returns `sum(student.lifetimePoints grouped by team) + HouseBonus +
GroupBonus`. Consequences worth knowing:
- Reassigning a student's `team` automatically moves their point contribution. No ledger to migrate.
- Deducting a student's `lifetimePoints` also corrects their house total in the same write.
- `LeaderboardCache` has a `"team"` row type that is written but **never read anywhere**.

**Roles.** `StaffRole` enum: `admin`, `teacher`, `power_user`. Students are a separate model
(role `"student"` in session). `power_user` = every teacher capability **plus** house-point
bulk awards, house-only challenges, and the house wheel — and nothing else admin. Points a
power user awards must only ever affect house totals, never a student's personal balance
(`addToTotal` is forced `false` for them).

**Privacy rule that runs through the whole app:** students and teachers never see another
student's individual totals outside their own scope. House aggregates are public; individual
data is not. Teacher challenge visibility is scoped to their own grades/homerooms; house-type
challenges are visible to everyone.

## Email

Sender is `PCS Bulldog Bank <pcsmall@providentcharterschool.org>` via Resend. The mailbox
local-part is still `pcsmall`; only the display name was rebranded.

- **Admin digest** — `app/api/cron/digest/route.ts`, twice each weekday (12:30 and 19:00 UTC
  per `vercel.json`), authenticated with `CRON_SECRET`. Section order matters and was set by
  the user: proposals → new requests → outstanding → **Golden Bulldog certificates** →
  **cancellations always last**. Recipients come from the `DigestRecipient` table (also the
  "approval email" list, editable in admin Settings).
- **Golden Bulldog certificates** — `lib/goldenBulldogCertificate.ts`, sent on award creation
  to the student's `StudentGuardian` rows.

> ⚠️ **Family emails are gated OFF and must stay off.** The `family_golden_bulldog_emails_enabled`
> setting (default `"false"`, toggle on the admin Settings page) gates all certificate email
> to guardians. Russ explicitly said **do not begin sending to families until he says so** —
> he is still finalizing the wording. Do not flip this setting, and do not remove the gate,
> without an explicit go-ahead from him in the conversation.

`/api/cron/*` and `/api/auth/*` are excluded from the auth redirect in `middleware.ts`.

## Data imports (PowerSchool CSVs)

Two export layouts are both accepted by `app/api/classes/bulk-upload/route.ts` — no manual
header editing needed:

- Newer *"Section Enrollment w/ Houses"*: `Student Number` (matches `Student.externalId`,
  preferred key), `Stud Lastfirst`, `Section Number`, plus a `House` column that is
  **deliberately ignored** — house assignment is managed inside the app.
- Older *"Section Enrollment Report"*: `First Name`/`Last Name` + `Abbreviation`; falls back
  to name matching with grade as tiebreaker.

Each `Course Name` row becomes a `Class` — including `"2 HOMEROOM"` rows, which are treated
like any other course. **Co-teaching:** when two teachers are listed for the same
course+section, each gets their own `Class` record pointing at the identical roster, so both
see the same students. The separate `Student.homeroom` text field (values like `"Casto"`,
`"Ramsey"`) is only used for report grouping and leaderboard filtering — it is *not* how
teachers get access to students, and the importer does not touch it.

Guardian contacts import into `StudentGuardian` from a *"Student and Guardian Emails"* export
(note the header is `Stu LastFirst`, no "d"). Roughly 297 students have a contact on file.

## Working conventions

**One-off production data operations.** Write a throwaway script at `scripts/_name.ts` (must
live inside the project so the `@/` alias resolves), run it with `npx tsx scripts/_name.ts`
against the production Neon DB, then **delete the script and the empty `scripts/` dir**. The
directory is not tracked and should never be committed. Long imports (thousands of rows) run
several minutes — background them.

**Windows notes.** A running `tsx` script holds a lock on the Prisma query engine DLL, so
`npm run build` fails with `EPERM ... query_engine-windows.dll.node` until it exits — just
wait and rerun. Apostrophes in multi-line `git commit -m` break the Bash heredoc; write the
message to a temp file and use `git commit -F`.

**Before bulk changes**, verify assumptions with a read-only scan script first (count
matches, list unmatched rows, check for name collisions). Several real bugs — a wrong CSV
header key, a student missing an `externalId` — were caught this way before touching data.

**Reporting.** State outcomes plainly and surface every gap found: unmatched rows, students
skipped, records with no email. Russ acts on those lists directly.

## Recent history worth knowing

- A UI bug let rapid/stuck taps on the teacher roster's quick-award buttons fire duplicate
  awards — one student received 132 stacked `+3` awards in under a minute. Fixed by disabling
  a student's buttons while their request is in flight (`app/dashboard/TeacherRoster.tsx`).
  All 13 historical bursts were reversed (~553 excess points removed).
- The admin Reports page had an infinite render loop on the Week/Semester filters because the
  since-date was recomputed from `new Date()` on every render; it is now memoized on `period`.
  Watch for that pattern.
- The class schedule was fully replaced (cleared, then reimported) from the current roster —
  783 classes, 8,260 enrollments, 298 students, zero errors.

## Open items

- **Waiting on Russ**: final wording for the outgoing family certificate email. Family
  emails stay disabled until then.
- 17 students in the system have **no guardian email on file** (Zayden Kendrick has a row in
  the guardian export but a blank email cell; the other 16 are absent from the export
  entirely).
- 17 students appear in the guardian export but **do not exist in the system** — mostly
  siblings of enrolled students. They were not added because that export carries no
  grade/homeroom data to place them correctly.
