# 🚀 ORBIT — Full Deployment Guide
> Zero to live in ~20 minutes. Free tier the whole way.

---

## What You'll Have After This Guide
| Layer | Service | Cost |
|---|---|---|
| Frontend | Vercel | Free |
| Database | Supabase (Postgres) | Free (500MB) |
| Auth | Supabase Auth | Free |
| AI Features | Google Gemini 1.5 Flash | Free (1M tokens/day) |
| Realtime DMs | Supabase Realtime | Free |
| Domain | yourapp.vercel.app | Free |

---

## Step 1 — Get Your Gemini API Key (5 min)

1. Go to **https://aistudio.google.com/**
2. Sign in with your Google account (your Gemini Pro subscription works here)
3. Click **"Get API key"** → **"Create API key"**
4. Copy and save it — looks like: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

> ✅ Gemini 1.5 Flash is free up to 1 million tokens/day. Your Gemini Pro gives you higher rate limits.

---

## Step 2 — Set Up Supabase (10 min)

### 2a. Create Project
1. Go to **https://supabase.com** → Sign up (free)
2. Click **"New Project"**
3. Name it: `orbit-platform`
4. Set a strong database password (save it!)
5. Choose region closest to your college (e.g., `ap-south-1` for India)
6. Click **Create Project** — wait ~2 minutes

### 2b. Run the Database Schema
1. In Supabase Dashboard → left sidebar → **SQL Editor**
2. Click **"New Query"**
3. Open the file `supabase/schema.sql` from this project
4. Paste the entire contents into the editor
5. Click **"Run"** (green button)
6. You should see: `Success. No rows returned`

### 2c. Enable Realtime (for live DMs)
1. Supabase Dashboard → **Database** → **Replication**
2. Click on **"supabase_realtime"**
3. Toggle ON these tables: `students`, `dms`, `community_messages`, `interview_requests`

### 2d. Enable pg_cron (for 48h message deletion)
1. Supabase Dashboard → **Database** → **Extensions**
2. Search for `pg_cron` → Enable it
3. Go back to SQL Editor and run:
```sql
select cron.schedule(
  'delete-expired-dms',
  '0 * * * *',
  $$delete from dms where expires_at < now();
    delete from community_messages where expires_at < now();$$
);
```

### 2e. Get Your Supabase Credentials
1. Go to **Settings** → **API**
2. Copy:
   - **Project URL**: `https://xxxx.supabase.co`
   - **anon/public key**: `eyJhbGciO...` (the long one)

---

## Step 3 — Deploy to Vercel (5 min)

### 3a. Push to GitHub
```bash
# In the orbit-deploy folder:
git init
git add .
git commit -m "ORBIT v1.0 🚀"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/orbit-platform.git
git push -u origin main
```

### 3b. Deploy on Vercel
1. Go to **https://vercel.com** → Sign up with GitHub (free)
2. Click **"Add New Project"**
3. Import your `orbit-platform` GitHub repo
4. Framework preset will auto-detect as **Vite**
5. Click **"Deploy"** — Vercel builds and deploys automatically

### 3c. That's it! 🎉
Your app is live at: `https://orbit-platform-xxxx.vercel.app`

---

## Step 4 — Connect Gemini AI in the App

When you first open your deployed ORBIT:
1. A setup screen appears asking for your **Gemini API Key**
2. Paste your key from Step 1
3. Click **"Connect & Launch"**
4. The key is stored securely in your browser's localStorage (never sent to any server)

---

## Step 5 — Local Development (optional)

```bash
# Install Node.js from nodejs.org first (v18+)
cd orbit-deploy
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## Updating the App Later

```bash
# Make changes to src/App.jsx
git add .
git commit -m "Update: added new feature"
git push
# Vercel auto-redeploys in ~60 seconds!
```

---

## Adding Real Data (Connecting Supabase)

The current app uses demo data. To connect live Supabase:

1. Open `src/App.jsx`
2. At the top, add:
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://YOUR_PROJECT.supabase.co',
  'YOUR_ANON_KEY'
)
```

3. Install the Supabase client:
```bash
npm install @supabase/supabase-js
```

4. Replace mock data calls. Example — load students:
```javascript
// Instead of: const[students,setStudents]=useState(STUDENTS)
useEffect(() => {
  supabase.from('students').select('*').then(({ data }) => {
    if (data) setStudents(data)
  })
}, [])
```

5. Enable Supabase Realtime for live DMs:
```javascript
useEffect(() => {
  const channel = supabase
    .channel('dms')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dms' },
      (payload) => setDms(p => [...p, payload.new])
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}, [])
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Gemini AI not responding | Check API key in Settings → re-enter key |
| App shows blank page | Check browser console for errors |
| Vercel build fails | Run `npm run build` locally first to catch errors |
| Supabase connection error | Check Project URL and anon key in your code |
| Camera not working in interview | Allow camera permission in browser, use HTTPS |

---

## Architecture Overview

```
Browser (React + Vite)
    │
    ├── Gemini API ──── AI features (Beacon, Mock Test, Interview)
    │   (direct from browser, key in localStorage)
    │
    └── Supabase
        ├── PostgreSQL ── Students, Staff, Offers, DMs, Results
        ├── Auth ──────── Login/signup
        ├── Realtime ──── Live DMs and notifications
        └── Storage ───── Resume PDFs (optional)
```

---

## File Structure

```
orbit-deploy/
├── index.html              ← Entry HTML
├── package.json            ← Dependencies  
├── vite.config.js          ← Build config
├── src/
│   ├── main.jsx            ← React entry point
│   └── App.jsx             ← Entire ORBIT app (3000+ lines)
└── supabase/
    └── schema.sql          ← Full database schema
```
