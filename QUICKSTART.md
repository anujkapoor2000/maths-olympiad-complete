# Quick Setup (5 minutes)

## Step 1: Create Neon Database (2 min)
1. Go to https://console.neon.tech
2. Sign up for free
3. Create new project called "mathsolympiad"
4. Copy this connection string:
   ```
   postgresql://user:password@ep-xxxxx.neon.tech/mathsolympiad?sslmode=require
   ```

## Step 2: Deploy to Vercel (2 min)
1. Push your code to GitHub
2. Go to https://vercel.com → New Project
3. Import your GitHub repo
4. Add Environment Variable:
   - Key: `DATABASE_URL`
   - Value: [paste Neon connection string]
5. Click Deploy

## Step 3: Initialize Database (1 min)
1. Go back to Neon console
2. Click SQL Editor
3. Paste entire contents of `seed.sql`
4. Run it

## Step 4: Create Demo Users (1 min)
In Neon SQL Editor, run:
```sql
INSERT INTO users (username, password, name, type) 
VALUES ('child', 'child123', 'Child', 'child');

INSERT INTO users (username, password, name, type) 
VALUES ('parent1', 'parent123', 'Parent 1', 'parent');

-- Get IDs for these users
SELECT id, username FROM users;

-- Create progress records (replace 1,2,3 with actual IDs)
INSERT INTO user_progress (user_id) VALUES (1);
INSERT INTO user_progress (user_id) VALUES (2);
```

## Done!
Your app is live at: `https://your-project-name.vercel.app`

Login with:
- **child** / **child123**
- **parent1** / **parent123**

---

## File Checklist
- ✅ package.json (dependencies)
- ✅ server.js (Express API)
- ✅ seed.sql (60 questions + tables)
- ✅ public/App.jsx (React frontend)
- ✅ public/App.css (styling)
- ✅ .env.example (configuration template)
- ✅ README.md (overview)
- ✅ DEPLOYMENT.md (detailed guide)

---

## What You Get

**For Your Child:**
- 60 curriculum questions (Year 6-9)
- Daily challenges with randomized questions
- Instant feedback on answers
- Coin rewards for correct answers
- Progress tracking

**For Parents:**
- Monitor child's daily progress
- See accuracy and coins earned
- Weekly performance analytics
- Upload past papers for practice

**Behind the Scenes:**
- Serverless Express API
- Neon Postgres database
- Automatic backups
- Scales to handle 100+ students
- Free hosting on Vercel

---

## Troubleshooting

**Login failed**
→ Check users table in Neon: `SELECT * FROM users;`

**Questions not showing**
→ Verify seed.sql ran: `SELECT COUNT(*) FROM questions;`

**Database connection error**
→ Check DATABASE_URL in Vercel settings

**App won't load**
→ Check Vercel deployment logs: vercel.com/dashboard

---

## Questions?

Detailed guide: Read `DEPLOYMENT.md`
Full docs: Read `README.md`
