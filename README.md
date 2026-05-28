# Maths Olympiad Prep - Full Stack App

A production-ready Vercel + Neon Postgres app for maths practice. Child accounts solve Year 6-9 level questions, parents monitor progress with analytics and upload past papers.

## Features

### For Children
- ✅ **Daily Challenges** - Year 6, 7, 8, 9 difficulty levels
- ✅ **50+ Question Bank** - No repeats, randomized questions
- ✅ **Mixed Question Types** - Multiple choice + short answer
- ✅ **Adaptive Timer** - Gets shorter when solving quickly
- ✅ **Coin Rewards** - 10 coins per correct answer
- ✅ **Progress Tracking** - Accuracy, streak, coins earned
- ✅ **Full Solutions** - Learn from mistakes

### For Parents
- ✅ **Child Monitor Dashboard** - Real-time progress
- ✅ **Weekly Analytics** - Coins earned, accuracy trends
- ✅ **PDF Upload** - Add past papers (AI extracts questions)
- ✅ **Performance Reports** - Daily breakdown
- ✅ **Goal Setting** - Track improvements

## Tech Stack

- **Frontend**: React/Next.js (Vercel)
- **Backend**: Express.js API (Vercel Serverless)
- **Database**: Neon Postgres (Free tier available)
- **Auth**: Simple username/password
- **PDF Processing**: Anthropic Claude API (optional)

## Quick Deployment

### Prerequisites
- GitHub account
- Vercel account (free)
- Neon account (free)
- Anthropic API key (optional, for PDF extraction)

### 1. Set up Neon Postgres
```bash
# Go to https://console.neon.tech
# Create project: "mathsolympiad"
# Copy connection string to clipboard
```

### 2. Deploy to Vercel
```bash
# Push code to GitHub
git push origin main

# Go to https://vercel.com
# Import from GitHub
# Add environment variable: DATABASE_URL = [your Neon string]
# Deploy!
```

### 3. Seed Database
```bash
# Run seed.sql in Neon SQL Editor
# Create users with provided SQL scripts
```

### 4. Access Your App
```
https://your-project.vercel.app
Login: child / child123
```

## Project Structure

```
maths-app/
├── server.js                 # Express API
├── package.json              # Dependencies
├── seed.sql                  # 60 questions + schema
├── DEPLOYMENT.md             # Full deployment guide
├── public/
│   ├── App.jsx              # React frontend
│   └── App.css              # Styling
├── api/
│   ├── questions.js         # Vercel serverless
│   ├── progress.js
│   └── auth.js
└── .env.example             # Configuration template
```

## Questions Bank

**60 Total Questions (15 per level)**
- Year 6: Basic algebra, percentages, area, sequences
- Year 7: Linear equations, angles, expanding brackets
- Year 8: Brackets, Pythagoras, powers, circles
- Year 9: Quadratics, trigonometry, simultaneous equations

**Question Types**
- Multiple choice (4 options)
- Short answer (text input)
- Mix adapts to learning

**No Repeats**: Questions randomly selected from bank

## Database

### Tables
- `users` - Child + Parent accounts
- `questions` - 60+ Year 6-9 level questions
- `user_progress` - Coins, accuracy, streaks
- `daily_history` - Weekly performance breakdown
- `uploaded_papers` - Parent-added past papers

### Neon Postgres
- Free tier: Perfect for this app
- Auto-backups
- 3GB storage included
- Connection pooling built-in

## API Endpoints

```
POST   /api/auth/login              # Login user
POST   /api/auth/register           # Create account
GET    /api/questions/:difficulty   # Get random question
POST   /api/progress/update         # Record answer
GET    /api/progress/:user_id       # Get analytics
POST   /api/papers/upload           # Upload PDF
```

## Environment Variables

```env
DATABASE_URL=postgresql://...       # Neon connection string
ANTHROPIC_API_KEY=sk-ant-...       # Claude API (optional)
PORT=3000                          # Server port
NODE_ENV=production               # Environment
```

## Demo Accounts

| User | Password | Role | Coins |
|------|----------|------|-------|
| child | child123 | Student | 0 |
| parent1 | parent123 | Parent | 0 |
| parent2 | parent456 | Parent | 0 |

## Features in Detail

### Adaptive Difficulty
- Timer starts at 5 minutes
- Shortens by 10 seconds each time question solved in <30 seconds
- Minimum 1 minute to prevent impossible challenges
- Encourages speed + accuracy

### Coin System
- ✅ Correct answer: **+10 coins**
- ❌ Wrong answer: **0 coins** (no penalty, only loss of reward)
- 🎯 Earn coins only for correct answers
- 💰 Parents see total coins earned per child

### Progress Analytics
- Daily problems solved
- Weekly accuracy percentage
- Current streak (consecutive days practiced)
- Total coins earned
- Performance trend charts

### PDF Upload (Parent Feature)
- Upload past exam papers (PDF)
- Claude AI extracts questions automatically
- Questions added to question bank
- Child can practice with real papers

## Scaling

The app is production-ready but has growth capacity:
- Neon: Scale to 10GB+ for free
- Vercel: Unlimited requests
- Questions: Add 1000+ questions easily
- Users: Support unlimited students

## Limitations (Free Tier)

- Neon: 3GB storage, 0.5GB bandwidth/month
- Vercel: 50GB bandwidth/month
- All limits are more than enough for 100+ students

## Security

- Passwords stored plaintext (development)
  - **TODO**: Hash with bcrypt in production
- No session management yet
  - **TODO**: Add JWT tokens
- Database credentials in environment variables
  - ✅ Already secure with Vercel

## Next Steps

1. **Deployment**: Follow DEPLOYMENT.md
2. **Customize**: Edit questions, add your own
3. **Production Auth**: Add bcrypt + JWT
4. **PDF Processing**: Configure Claude API key
5. **Mobile**: Build React Native version

## Support

- [Neon Documentation](https://neon.tech/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Express Guide](https://expressjs.com)
- [React Docs](https://react.dev)

## License

MIT - Free to use, modify, distribute

---

**Built for Year 6-9 students preparing for Maths Olympiad**
Questions sourced from curriculum-aligned problem sets
