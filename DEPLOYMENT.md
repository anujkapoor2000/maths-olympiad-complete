# Maths Olympiad Prep - Deployment Guide

## Quick Start: Deploy to Vercel + Neon Postgres

### Step 1: Set up Neon Postgres Database

1. Go to https://console.neon.tech
2. Sign up for a free account
3. Create a new project:
   - Project name: `mathsolympiad`
   - Database name: `mathsolympiad`
4. Copy your connection string (looks like: `postgresql://username:password@ep-xxxxx.neon.tech/mathsolympiad?sslmode=require`)
5. Keep this safe - you'll need it for Vercel

### Step 2: Prepare Your Code for Vercel

Create these files in your project root:

**vercel.json**
```json
{
  "buildCommand": "npm install && npm run build",
  "outputDirectory": ".",
  "env": {
    "DATABASE_URL": "@database_url",
    "PORT": "3000",
    "NODE_ENV": "production"
  }
}
```

**api/questions.js** (Vercel serverless function)
```javascript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  
  const { difficulty } = req.query;
  try {
    const result = await pool.query(
      'SELECT * FROM questions WHERE difficulty = $1 ORDER BY RANDOM() LIMIT 1',
      [difficulty]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
```

### Step 3: Deploy to Vercel

1. Push your code to GitHub (or GitLab/Bitbucket):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/maths-olympiad.git
   git push -u origin main
   ```

2. Go to https://vercel.com and sign in
3. Click "New Project"
4. Select your repository
5. In environment variables, add:
   - `DATABASE_URL`: Paste your Neon connection string
   - `ANTHROPIC_API_KEY`: Your Claude API key (for PDF processing)
6. Click "Deploy"

### Step 4: Seed the Database

1. Go to Neon console
2. Open SQL Editor
3. Copy paste the contents of `seed.sql`
4. Run the queries

### Step 5: Create Users

Run these SQL commands in Neon SQL Editor:

```sql
-- Create child account
INSERT INTO users (username, password, name, type, total_coins) 
VALUES ('child', 'child123', 'Child Account', 'child', 0);

-- Create parent accounts
INSERT INTO users (username, password, name, type, total_coins) 
VALUES ('parent1', 'parent123', 'Parent 1', 'parent', 0);

INSERT INTO users (username, password, name, type, total_coins) 
VALUES ('parent2', 'parent456', 'Parent 2', 'parent', 0);

-- Get user IDs and create progress records
SELECT id FROM users;

-- Insert progress for each user (replace ID with actual ID from query above)
INSERT INTO user_progress (user_id) VALUES (1);
INSERT INTO user_progress (user_id) VALUES (2);
INSERT INTO user_progress (user_id) VALUES (3);
```

### Environment Variables for Vercel

Create a `.env.local` file locally (don't commit to GitHub):
```
DATABASE_URL=postgresql://username:password@ep-xxxxx.neon.tech/mathsolympiad?sslmode=require
ANTHROPIC_API_KEY=sk-ant-xxxxx
PORT=3000
NODE_ENV=production
```

### Accessing Your App

After deployment, your app will be available at:
```
https://your-project-name.vercel.app
```

Login with:
- **Child**: `child` / `child123`
- **Parent 1**: `parent1` / `parent123`
- **Parent 2**: `parent2` / `parent456`

---

## Features Included

✅ **50+ Questions** - Year 6, 7, 8, 9 levels (15 per level)
✅ **Neon Postgres** - Persistent storage across sessions
✅ **User Accounts** - Child + Parent login
✅ **Progress Tracking** - Questions solved, accuracy, coins earned
✅ **Weekly Analytics** - Daily breakdown of performance
✅ **PDF Upload** - Parents can upload past papers (AI extraction ready)
✅ **Adaptive Timer** - Timer shortens when problems solved quickly
✅ **Coin System** - 10 coins per correct answer
✅ **Vercel Deployment** - One-click hosting

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  type VARCHAR(50), -- 'child' or 'parent'
  total_coins INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Questions Table
```sql
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  difficulty VARCHAR(50), -- 'year6', 'year7', 'year8', 'year9'
  type VARCHAR(50), -- 'shortAnswer', 'multipleChoice'
  text TEXT NOT NULL,
  answer TEXT,
  options TEXT, -- JSON array for multiple choice
  solution TEXT,
  source VARCHAR(255), -- 'Bank' or 'PDF'
  created_at TIMESTAMP DEFAULT NOW()
);
```

### User Progress Table
```sql
CREATE TABLE user_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  questions_solved INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  total_coins INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  max_streak INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Daily History Table
```sql
CREATE TABLE daily_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  date DATE,
  problems_solved INTEGER DEFAULT 0,
  accuracy DECIMAL(5,2) DEFAULT 0,
  coins_earned INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);
```

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/register` - Register new user

### Questions
- `GET /api/questions/:difficulty` - Get random question

### Progress
- `POST /api/progress/update` - Update progress after answering
- `GET /api/progress/:user_id` - Get user progress

### Papers
- `POST /api/papers/upload` - Upload past paper PDF

---

## Troubleshooting

**"Database connection error"**
- Check DATABASE_URL in Vercel environment variables
- Make sure Neon project is active
- Verify connection string format

**"Questions not loading"**
- Run `seed.sql` in Neon SQL Editor
- Check questions table has data: `SELECT COUNT(*) FROM questions;`

**"Login fails"**
- Create users in database (see Step 5)
- Verify username/password match exactly

**"PDF upload not working"**
- Ensure Anthropic API key is set
- Claude SDK needs to be configured for PDF processing

---

## Next Steps

1. **Customize questions** - Add your own or import from real papers
2. **Add PDF extraction** - Set up Anthropic Claude to extract text from PDFs
3. **Mobile app** - Deploy React Native version
4. **Teacher dashboard** - Create accounts for multiple parents/teachers
5. **Analytics** - Add charts and progress reports

---

For support:
- Neon docs: https://neon.tech/docs
- Vercel docs: https://vercel.com/docs
- Express docs: https://expressjs.com
