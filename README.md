# Fuel Log — Falmouth → Hyrox Boston

Personal nutrition tracker with AI meal analysis, voice input, and photo scanning.
Runs as a PWA — add to iPhone home screen for a native app feel.

---

## Deploy in ~30 minutes

### Step 1 — Supabase (database)

1. Go to [supabase.com](https://supabase.com) → **New project** (free tier)
2. Give it a name, pick a region close to you, set a database password
3. Once created, go to **SQL Editor** → **New query**
4. Paste the entire contents of `supabase-schema.sql` and click **Run**
5. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Step 2 — Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. **API Keys → Create key**
3. Copy it → `ANTHROPIC_API_KEY`
4. Make sure your account has Claude Sonnet access (it will if you're using Claude.ai)

### Step 3 — GitHub repo

```bash
# In your terminal:
git init
git add .
git commit -m "initial"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/fuel-log.git
git push -u origin main
```

### Step 4 — Vercel deploy

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Click **Environment Variables** and add all four:

```
ANTHROPIC_API_KEY        = sk-ant-...
NEXT_PUBLIC_SUPABASE_URL = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
APP_PIN                  = your-chosen-pin (e.g. 1234)
```

5. Click **Deploy** — takes about 2 minutes
6. Your app is live at `https://fuel-log-xxx.vercel.app`

### Step 5 — Add to iPhone home screen

1. Open your Vercel URL in **Safari** on iPhone
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Name it "Fuel Log" → **Add**

It now opens full-screen like a native app, no browser chrome.

---

## Local development

```bash
cp .env.example .env.local
# Fill in your values in .env.local

npm install
npm run dev
# Open http://localhost:3000
```

---

## Project structure

```
src/
  app/
    page.tsx              ← Full tracker UI (React)
    layout.tsx            ← HTML shell, fonts, PWA meta
    globals.css           ← All styles
    api/
      auth/route.ts       ← PIN check
      analyze/route.ts    ← Proxies Anthropic API (chat + photo)
      logs/route.ts       ← GET/POST/PATCH daily entries
      log/[id]/route.ts   ← DELETE single entry
  lib/
    supabase.ts           ← Supabase client + types
    constants.ts          ← Targets, quick foods, AI prompts
public/
  manifest.json           ← PWA manifest
supabase-schema.sql       ← Run once in Supabase SQL editor
```

---

## Costs

| Service    | Free tier                          | When you'd pay           |
|------------|------------------------------------|--------------------------|
| Vercel     | Unlimited personal deploys         | Never (personal app)     |
| Supabase   | 500MB DB, 2GB bandwidth            | Never (personal app)     |
| Anthropic  | Pay per API call                   | ~$0.01–0.05 per AI query |

Anthropic cost: Claude Sonnet is ~$3/million input tokens. A typical meal analysis call is ~500 tokens. At 5 AI calls/day, that's roughly **$0.75/month**.

---

## Updating the app

Any push to your GitHub `main` branch auto-deploys via Vercel. To update:

```bash
# Make your changes, then:
git add .
git commit -m "update"
git push
```

Vercel rebuilds and deploys in ~60 seconds.
