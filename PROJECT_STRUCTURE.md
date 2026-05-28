# Project Structure

```
maths-olympiad-prep/
│
├── 📄 Documentation
│   ├── README.md                 # Project overview & features
│   ├── QUICKSTART.md             # 5-minute setup guide
│   ├── DEPLOYMENT.md             # Detailed deployment instructions
│   └── PROJECT_STRUCTURE.md      # This file
│
├── 🔧 Configuration
│   ├── package.json              # Node.js dependencies
│   ├── .env.example              # Environment variables template
│   ├── .gitignore                # Git ignore rules
│   └── vercel.json               # Vercel deployment config
│
├── 💻 Backend
│   └── server.js                 # Express.js API server
│       ├── Database connection (Neon Postgres)
│       ├── Auth endpoints
│       ├── Questions API
│       ├── Progress tracking
│       └── PDF upload handling
│
├── 🎨 Frontend
│   └── public/
│       ├── App.jsx               # React main component
│       ├── App.css               # Styling
│       └── index.html            # HTML entry point
│
├── 🗄️ Database
│   └── seed.sql                  # Database schema + 60 questions
│       ├── users table (child + parent accounts)
│       ├── questions table (60 Year 6-9 level questions)
│       ├── user_progress table (analytics)
│       ├── daily_history table (weekly breakdown)
│       └── uploaded_papers table (parent PDFs)
│
└── 🚀 CI/CD
    └── .github/
        └── workflows/
            └── deploy.yml        # GitHub Actions deployment
```

## File Descriptions

### Backend (server.js)
- Express.js REST API
- Neon Postgres connection pooling
- Authentication routes (login/register)
- Question randomization from database
- Progress tracking & analytics
- PDF upload endpoint
- Static file serving

### Frontend (App.jsx)
- React components for child & parent dashboards
- Login screen with demo accounts
- Challenge interface (mixed question types)
- Progress tracking UI
- Parent analytics dashboard
- PDF upload interface

### Database (seed.sql)
- Complete schema creation
- 60 pre-loaded questions:
  - 15 Year 6 level
  - 15 Year 7 level
  - 15 Year 8 level
  - 15 Year 9 level
- Sample user accounts
- Indexes for performance

### Configuration Files

**package.json**
- Express, PostgreSQL, CORS, Multer, Anthropic SDK
- Scripts: dev, build, start, seed

**.env.example**
- Template for environment variables
- Database URL, API keys, ports
- Copy to `.env.local` for local development

**vercel.json**
- Vercel deployment configuration
- Environment variable mapping
- Function timeout settings
- Route configuration

**.gitignore**
- Node modules, build artifacts
- Environment files, logs
- IDE settings, OS files

**.github/workflows/deploy.yml**
- Automatic deployment on push
- Node.js 18 setup
- Dependency installation
- Vercel integration

## API Endpoints

### Authentication
```
POST /api/auth/login
  Body: { username, password }
  Response: { id, username, name, type, total_coins, progress }

POST /api/auth/register
  Body: { username, password, name, type }
  Response: { id, username, name, type }
```

### Questions
```
GET /api/questions/:difficulty
  Params: difficulty (year6|year7|year8|year9)
  Response: { id, difficulty, type, text, answer, options, solution }
```

### Progress
```
POST /api/progress/update
  Body: { user_id, correct, difficulty }
  Response: { questions_solved, correct_answers, total_coins }

GET /api/progress/:user_id
  Response: { progress, history }
```

### Papers
```
POST /api/papers/upload
  Body: FormData { user_id, paper_name, file }
  Response: { id, user_id, paper_name, filename }
```

## Database Schema

### users
- id (PRIMARY KEY)
- username (UNIQUE)
- password
- name
- type (child|parent)
- total_coins
- created_at

### questions
- id (PRIMARY KEY)
- difficulty (year6|year7|year8|year9)
- type (shortAnswer|multipleChoice)
- text
- answer
- options (JSON array)
- solution
- source
- created_at

### user_progress
- id (PRIMARY KEY)
- user_id (FOREIGN KEY)
- questions_solved
- correct_answers
- total_coins
- current_streak
- max_streak
- created_at
- updated_at

### daily_history
- id (PRIMARY KEY)
- user_id (FOREIGN KEY)
- date
- problems_solved
- accuracy
- coins_earned
- UNIQUE(user_id, date)

### uploaded_papers
- id (PRIMARY KEY)
- user_id (FOREIGN KEY)
- paper_name
- filename
- created_at

## Development Workflow

1. **Clone repository**
   ```bash
   git clone https://github.com/your-username/maths-olympiad.git
   cd maths-olympiad
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

4. **Run locally**
   ```bash
   npm run dev
   # Server runs on http://localhost:3000
   ```

5. **Deploy to Vercel**
   ```bash
   # Push to GitHub
   git push origin main
   # Vercel auto-deploys via GitHub Actions
   ```

## Technologies

- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Frontend**: React
- **Database**: Neon Postgres
- **Hosting**: Vercel Serverless
- **Auth**: Username/Password (session-based)
- **File Upload**: Multer
- **PDF Processing**: pdf.js + Anthropic Claude
- **API**: REST JSON
- **CI/CD**: GitHub Actions

## Performance Optimizations

- Database connection pooling (Vercel)
- Random question selection (prevents repeats)
- Async/await for non-blocking operations
- Static file caching
- Neon auto-backup & replication

## Security Considerations

- [ ] Hash passwords with bcrypt
- [ ] Add JWT tokens for sessions
- [ ] Validate all inputs server-side
- [ ] Use HTTPS only
- [ ] Rate limiting on API endpoints
- [ ] CORS configuration per environment
- [ ] SQL injection prevention (using parameterized queries)

## Monitoring & Logging

- Vercel analytics included
- Server logs for debugging
- Database query logging available
- Error tracking ready for Sentry integration

## Future Enhancements

- Real-time leaderboard with WebSockets
- Email notifications for parents
- Mobile app (React Native)
- Advanced analytics & reports
- Teacher dashboard for managing multiple students
- Video explanations for solutions
- Difficulty adaptation algorithm
- Timed exams & mock tests
