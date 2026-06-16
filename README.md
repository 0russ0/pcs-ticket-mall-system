# Student Rewards System

A multi-school student points & rewards platform: students earn points from staff for
behavior/academics/attendance/citizenship and redeem them at a school "mall". Includes
leaderboards (school-wide, homeroom, team) and full admin tooling.

## Tech Stack

- Next.js 15 (App Router) + React 19 + Tailwind CSS
- NextAuth v5 (Google SSO, domain-restricted)
- Prisma + PostgreSQL
- Vercel Blob for product images

## Local App URL

Once running, open: **http://localhost:3000/login**

You'll see a "Sign in with Google" button. Click it to start the SSO flow.

---

## Google OAuth Setup (CRITICAL — read before testing)

The `invalid_client` error means credentials are wrong or the app type is incorrect.

### Step-by-step in Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. In the left menu: **APIs & Services → OAuth consent screen**
   - User type: **Internal** (if using Google Workspace) or **External** for testing
   - Fill in App name, support email, developer email → Save
4. In the left menu: **APIs & Services → Credentials**
5. Click **+ CREATE CREDENTIALS → OAuth 2.0 Client IDs**
6. Application type: **Web application** ← THIS IS THE CRITICAL PART. NOT "Desktop app".
7. Name it anything (e.g. "Student Rewards Dev")
8. Under **Authorized redirect URIs**, click **+ ADD URI** and add:
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
   - `https://yourapp.vercel.app/api/auth/callback/google` (for production — add later)
9. Click **Create** → copy the **Client ID** and **Client Secret**

### Then update your `.env.local`:

```
GOOGLE_CLIENT_ID=<paste your Client ID here>
GOOGLE_CLIENT_SECRET=<paste your Client Secret here>
```

Restart the dev server after editing `.env.local`.

---

## Local Setup

1. Copy `.env.local.example` to `.env.local` and fill in values:
   - `DATABASE_URL` — Postgres connection string (Vercel Postgres, Neon, etc.)
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console (see OAuth setup above)
   - `ALLOWED_GOOGLE_DOMAIN` — e.g. `yourdomain.edu` (leave blank to allow any Google account in dev)
   - `BLOB_READ_WRITE_TOKEN` — Vercel Blob token (for product image uploads, optional for dev)

2. Install dependencies:
   ```bash
   npm install
   ```

3. Push the schema to your database:
   ```bash
   npx prisma migrate dev --name init
   ```

4. Seed sample data (2 schools, 50 products, ~225 students/school, 75 staff/school):
   ```bash
   npm run seed
   ```

5. Run the dev server:
   ```bash
   npm run dev
   ```

## Logging In

Login is via Google SSO. To log in as a real user, an admin must add your Google account's
email to the `staff` table (role `admin` or `teacher`) via `/admin/staff`, or add it to a
`student` record's `google_email` column for student access. The seed script creates one
admin per school with a placeholder email (`<slug>.staff1@example.edu`) — update this to a
real address via Prisma Studio (`npx prisma studio`) to get started.

## Key Routes

- `/dashboard` — role-based home (student / teacher / admin)
- `/dashboard/award-points` — teacher/admin point award form
- `/leaderboards` — school-wide, homeroom, and team leaderboards
- `/store`, `/store/cart`, `/orders` — student shopping + order history
- `/admin/orders` — approval/completion queue
- `/admin/products`, `/admin/products/upload` — store management + CSV bulk upload
- `/admin/students/upload` — student roster CSV upload
- `/admin/staff` — staff management
- `/admin/settings` — point caps, categories, store open/closed

## Deployment (Vercel)

1. Push to GitHub, import into Vercel.
2. Set all env vars from `.env.local.example` in the Vercel project settings
   (`NEXTAUTH_URL` = your production URL).
3. Add the production callback URL to Google Cloud Console:
   `https://yourdomain.vercel.app/api/auth/callback/google`
4. Run `npx prisma migrate deploy` against the production database.
