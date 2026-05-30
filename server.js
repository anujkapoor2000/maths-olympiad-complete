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

// Kick off schema creation + demo seeding once per instance. (initializeDB is a
// hoisted function declaration, so it can be invoked before its definition.)
const dbReady = initializeDB();

// Gate every request until the database is ready. On serverless cold starts the
// handler would otherwise race the (async) seeding and return 401s / empty data.
app.use(async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (err) {
    next(err);
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

    // Seed PMC Feb 2023 Bonus Round questions into Year 6 bank (idempotent)
    const pmcCheck = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE source = 'PMC Feb 2023'"
    );
    if (parseInt(pmcCheck.rows[0].count) === 0) {
      const pmcQuestions = [
        {
          text: "Pepper the Cat sleeps for 20 hours a day. What fraction of the day is she awake?",
          options: ["1/6","2/6","3/6","4/6","5/6"],
          answer: "1/6",
          solution: "Pepper sleeps for 20 hours a day so she is awake for 4 out of 24 hours each day. 4/24 = 1/6"
        },
        {
          text: "An apple, a pear and a peach cost 100p. An apple, a pear and two peaches cost 140p. How much does a peach cost?",
          options: ["10p","20p","22p","24p","40p"],
          answer: "40p",
          solution: "The difference in the two prices is the cost of the peach. 140p - 100p = 40p"
        },
        {
          text: "Addum thinks of a number, adds 6 to it, subtracts 4 and adds 3. He then subtracts the number he first thought of. What will his answer always be?",
          options: ["5","6","7","8","9"],
          answer: "5",
          solution: "Starting with any number will give an answer of 5. We add 6, subtract 4 and add 3 giving 5."
        },
        {
          text: "Rohit drew a quadrilateral. Three of its angles measured 120°, 120° and 80°. What sort of quadrilateral could Rohit have drawn?",
          options: ["kite","parallelogram","rectangle","rhombus","trapezium"],
          answer: "kite",
          solution: "The angles add up to 360°, so the fourth angle is 40°. The quadrilateral has no two pairs of equal angles and cannot be a parallelogram, rectangle, rhombus or trapezium. It can be a kite."
        },
        {
          text: "I walk for 6 miles at 3 mph and then run home at twice this speed. How long did my journey there and back last?",
          options: ["45 min","1 hr 30 min","1 hr 45 min","2 hr 15 min","3 hr"],
          answer: "3 hr",
          solution: "6 miles at 3 mph takes 2 hours. Returning at twice the speed (6 mph) takes one hour. Total: 3 hours."
        },
        {
          text: "Gulpa makes two cups of tea from each tea bag. Her husband makes three cups from each of his. They each drink 30 cups a week. How many tea bags do they use each week?",
          options: ["12","20","25","30","60"],
          answer: "25",
          solution: "Gulpa uses 30 ÷ 2 = 15 tea bags a week. Her husband uses 30 ÷ 3 = 10 tea bags a week. Total: 15 + 10 = 25."
        },
        {
          text: "10 teachers take 10 minutes to mark a total of 10 books, all marking at the same speed. How long does it take 1 teacher to mark 1 book?",
          options: ["6 seconds","1 min","2 min","5 min","10 min"],
          answer: "10 min",
          solution: "10 teachers mark 10 books in 10 minutes. So 1 teacher can mark 10 books in 100 minutes. Therefore 1 teacher can mark 1 book in 10 minutes."
        },
        {
          text: "Ben is putting rulers into packets, all containing the same number of rulers. He has just got to the 37th ruler and is working on packet 7. How many rulers are in each packet?",
          options: ["6","8","10","12","14"],
          answer: "6",
          solution: "If there were 6 rulers in each packet, he would have used 36 rulers and be starting on his 7th packet. So Ben is putting 6 rulers in each packet."
        },
        {
          text: "My dad is 180 cm tall. Three of his lengths are the same as four of mine. How tall am I?",
          options: ["80 cm","100 cm","120 cm","135 cm","140 cm"],
          answer: "135 cm",
          solution: "Three times dad's length is 3 × 180 = 540 cm. Dividing by 4 gives my length: 540 ÷ 4 = 135 cm."
        },
        {
          text: "Simone bought an action figure with 10% off the original price. James bought the same figure with 15% off. Simone paid 45p more than James. What was the original price?",
          options: ["£4.50","£5","£9","£10","£90"],
          answer: "£9",
          solution: "There is a 5% difference in price. If 5% of the full price is 45p then the full price was 20 × 45p = £9."
        },
        {
          text: "What is the difference in value between 2⁴ and 4²?",
          options: ["0","1","2","4","8"],
          answer: "0",
          solution: "2⁴ = 2 × 2 × 2 × 2 = 16. 4² = 4 × 4 = 16. The difference is zero."
        },
        {
          text: "After each round of a knockout netball competition the losing teams drop out. How many games are played to find a winner among 8 teams?",
          options: ["4","6","7","8","12"],
          answer: "7",
          solution: "In any one game, one team is knocked out. So 7 games are needed to eliminate 7 of the 8 teams."
        },
        {
          text: "Robyn buys a parrot for £50 and sells him for £60. Later she buys her parrot back for £70 and then sells him again for £80. How much profit has she made altogether?",
          options: ["£0","£5","£10","£20","£50"],
          answer: "£20",
          solution: "In the first transaction Robyn makes a profit of £10. She does the same in the second transaction. Total profit: £20."
        },
        {
          text: "In total, how many four-letter arrangements (including nonsense words) can you make using all four letters of the word TIME?",
          options: ["4","6","12","24","120"],
          answer: "24",
          solution: "There are 4 possibilities for the first letter, 3 for the second, and 2 for the third. Total: 4 × 3 × 2 = 24."
        },
        {
          text: "A very large box contains 4 large boxes. Each large box contains 2 small boxes. Each small box contains 4 tiny boxes. How many boxes are there in total?",
          options: ["32","36","40","42","45"],
          answer: "45",
          solution: "1 very large + 4 large + 8 small + 32 tiny = 45 boxes."
        },
        {
          text: "Maud makes mud pies. For every 20g of mud she uses 25g slime and 5g sand. She makes 1kg of mud pies in total. How much mud does she use?",
          options: ["20g","40g","50g","200g","400g"],
          answer: "400g",
          solution: "Each batch (20g mud + 25g slime + 5g sand) totals 50g. 1000 ÷ 50 = 20 batches. Mud used: 20 × 20g = 400g."
        },
        {
          text: "What is the area of a square whose diagonal measures 12 cm?",
          options: ["24 cm²","36 cm²","60 cm²","72 cm²","144 cm²"],
          answer: "72 cm²",
          solution: "The square contains 4 right-angled triangles each with area ½ × 6 × 6 = 18 cm². Total area: 4 × 18 = 72 cm²."
        },
        {
          text: "What is the angle between the minute hand and the hour hand of a clock showing half past two?",
          options: ["90°","100°","105°","110°","120°"],
          answer: "105°",
          solution: "The angle between 3 and 6 o'clock is 90°. The hour hand is halfway between 2 and 3, adding 15°. So the answer is 90° + 15° = 105°."
        },
        {
          text: "Alice needs a security guard 24 hours a day for 80 days. Each guard works 12 hours a day for 4 days then has 4 days off. What is the smallest number of guards needed?",
          options: ["2","3","4","5","6"],
          answer: "4",
          solution: "Each guard works 12 hours for 4 days, requiring 2 guards at a time. When those guards have 4 days off, 2 other guards are needed. Total: 4 guards."
        },
        {
          text: "What number: when multiplied by 8 is a multiple of 3; when divided by 9 is prime; when doubled contains a 3 or 1; when halved is a square but not 4?",
          options: ["9","13","17","18","27"],
          answer: "18",
          solution: "18 is the only number which, when halved, gives a square (9 = 3²). And 18 satisfies all four conditions."
        },
        {
          text: "Find the value of: √(number of degrees in a right angle ÷ number of mm in a metre)",
          options: ["0.1","0.3","0.9","1","3"],
          answer: "0.3",
          solution: "90 ÷ 1000 = 0.09. √0.09 = 0.3."
        },
        {
          text: "A cuboctahedron has 6 square faces and 8 equilateral triangular faces. Each square face is surrounded by triangles and each triangle by squares. How many edges does it have?",
          options: ["12","24","25","48","50"],
          answer: "24",
          solution: "There are 6 squares with 24 edges. These all touch the 24 edges of the 8 triangles. In total there are 24 edges."
        },
        {
          text: "What is the sum of all the whole numbers from 1 to 100?",
          options: ["101","1000","5000","5050","10100"],
          answer: "5050",
          solution: "Pair numbers that add to 101 (e.g. 1 + 100). There are 50 such pairs, so total = 50 × 101 = 5050."
        },
        {
          text: "There are 200 pupils in 7 classes. Three classes have exactly 30 pupils. Reception, Year 2 and Year 6 each have one fewer pupil than Year 1. Year 4 has more pupils than Year 3. How many pupils are in Year 3?",
          options: ["23","24","25","26","27"],
          answer: "23",
          solution: "Year 1, 4 and 5 have 30 pupils each. Reception, Year 2 and Year 6 have 29 each. 3×30 + 3×29 = 177. Year 3 = 200 - 177 = 23."
        },
        {
          text: "A multiplication table is encrypted with letters. W × W = XW and Y × W = ZW. From which times table could these two facts be true?",
          options: ["5","6","7","8","9"],
          answer: "5",
          solution: "If W × W = XW, W must be 5 or 6. But Y × W = ZW also ends in W, which only occurs in the 5 times table. So W must be 5."
        }
      ];

      for (const q of pmcQuestions) {
        await pool.query(
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          ['year6', 'multipleChoice', q.text, q.answer, JSON.stringify(q.options), q.solution, 'PMC Feb 2023']
        );
      }
      console.log('Seeded 25 PMC Feb 2023 questions into Year 6 bank');
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
       DO UPDATE SET problems_solved = daily_history.problems_solved + 1, coins_earned = daily_history.coins_earned + $3`,
      [user_id, today, coinsEarned]
    );

    res.json(progress.rows[0]);
  } catch (err) {
    console.error('Error updating progress:', err);
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

// (Schema creation + demo seeding is kicked off above as `dbReady`.)

// Only start a long-lived listener when executed directly (local dev / non-serverless
// hosts). On Vercel the exported app is invoked per-request as a serverless function.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
