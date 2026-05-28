require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Neon Postgres connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const upload = multer({ storage: multer.memoryStorage() });

// Test DB connection
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to Neon Postgres:', result.rows[0]);
  }
});

// Initialize database tables
async function initializeDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        type VARCHAR(50),
        total_coins INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        difficulty VARCHAR(50),
        type VARCHAR(50),
        text TEXT NOT NULL,
        answer TEXT,
        options TEXT,
        solution TEXT,
        source VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
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
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        date DATE,
        problems_solved INTEGER DEFAULT 0,
        accuracy DECIMAL(5,2) DEFAULT 0,
        coins_earned INTEGER DEFAULT 0,
        UNIQUE(user_id, date)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS uploaded_papers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        paper_name VARCHAR(255),
        filename VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Seed the demo accounts (idempotent) so the demo login buttons work out of
    // the box. seed.sql only loads questions, not users.
    const demoUsers = [
      ['child', 'child123', 'Child Account', 'child'],
      ['parent1', 'parent123', 'Parent 1', 'parent'],
      ['parent2', 'parent456', 'Parent 2', 'parent'],
    ];
    for (const [username, password, name, type] of demoUsers) {
      const inserted = await pool.query(
        `INSERT INTO users (username, password, name, type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO NOTHING
         RETURNING id`,
        [username, password, name, type]
      );
      if (inserted.rows[0]) {
        await pool.query(
          'INSERT INTO user_progress (user_id) VALUES ($1)',
          [inserted.rows[0].id]
        );
      }
    }

    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Authentication endpoints
app.post('/api/auth/register', async (req, res) => {
  const { username, password, name, type } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password, name, type) VALUES ($1, $2, $3, $4) RETURNING id, username, name, type',
      [username, password, name, type]
    );
    
    // Create progress record
    await pool.query(
      'INSERT INTO user_progress (user_id) VALUES ($1)',
      [result.rows[0].id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT id, username, name, type, total_coins FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const progress = await pool.query(
      'SELECT * FROM user_progress WHERE user_id = $1',
      [user.id]
    );

    res.json({ ...user, progress: progress.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Questions endpoints
app.get('/api/questions/:difficulty', async (req, res) => {
  const { difficulty } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM questions WHERE difficulty = $1 ORDER BY RANDOM() LIMIT 1',
      [difficulty]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Progress endpoints
app.post('/api/progress/update', async (req, res) => {
  const { user_id, correct, difficulty } = req.body;
  try {
    const coinsEarned = correct ? (difficulty === 'year6' ? 10 : difficulty === 'year7' ? 10 : difficulty === 'year8' ? 15 : 20) : 0;
    
    const progress = await pool.query(
      `UPDATE user_progress 
       SET questions_solved = questions_solved + 1,
           correct_answers = correct_answers + $2,
           total_coins = total_coins + $3,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [user_id, correct ? 1 : 0, coinsEarned]
    );

    // Update daily history
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO daily_history (user_id, date, problems_solved, coins_earned)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (user_id, date) 
       DO UPDATE SET problems_solved = problems_solved + 1, coins_earned = coins_earned + $3`,
      [user_id, today, coinsEarned]
    );

    res.json(progress.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/progress/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const progress = await pool.query(
      'SELECT * FROM user_progress WHERE user_id = $1',
      [user_id]
    );
    const history = await pool.query(
      'SELECT * FROM daily_history WHERE user_id = $1 ORDER BY date DESC LIMIT 7',
      [user_id]
    );
    res.json({ progress: progress.rows[0], history: history.rows });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PDF Upload endpoint
app.post('/api/papers/upload', upload.single('file'), async (req, res) => {
  const { user_id, paper_name } = req.body;
  try {
    // In production, process PDF with Claude API to extract questions
    const filename = req.file.originalname;
    
    const result = await pool.query(
      'INSERT INTO uploaded_papers (user_id, paper_name, filename) VALUES ($1, $2, $3) RETURNING *',
      [user_id, paper_name, filename]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Serve the built frontend when running as a standalone server.
// On Vercel the SPA is served from the CDN and this function only handles /api/*.
app.use(express.static(path.join(__dirname, 'dist')));

// Ensure tables exist (idempotent). Runs on cold start in serverless environments.
initializeDB();

// Only start a long-lived listener when executed directly (local dev / non-serverless
// hosts). On Vercel the exported app is invoked per-request as a serverless function.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
