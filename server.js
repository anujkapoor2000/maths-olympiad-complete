require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const { BADGES, BADGE_MAP, STREAK_THRESHOLDS, QUESTION_TIME_BY_LEVEL } = require('./badges');

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
        subject VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add subject column if it doesn't exist yet (idempotent migration)
    await pool.query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject VARCHAR(100);
    `);

    await pool.query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
    `);

    // Difficulty tier within a year/kangaroo level: 'easy' | 'medium' | 'hard'.
    // Nullable so existing untagged questions keep working with tier filters.
    await pool.query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS level VARCHAR(20);
    `);

    // Links a question to a Learn-tab topic id (see src/topics.js). Nullable —
    // not every question (e.g. logic puzzles) maps cleanly to one lesson.
    // Used to suggest a Learn topic when a child gets most of a topic wrong.
    await pool.query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic_id VARCHAR(50);
    `);

    // Patch image URLs onto already-seeded Kangaroo questions (idempotent)
    const imagePatches = [
      [1, '/images/jk2025/q1.png'],
      [2, '/images/jk2025/q2.png'],
      [3, '/images/jk2025/q3.png'],
      [4, '/images/jk2025/q4.png'],
      [5, '/images/jk2025/q5.png'],
      [6, '/images/jk2025/q6.png'],
      [8, '/images/jk2025/q8.png'],
      [14, '/images/jk2025/q14.png'],
      [16, '/images/jk2025/q16.png'],
      [18, '/images/jk2025/q18.png'],
      [20, '/images/jk2025/q20.png'],
      [22, '/images/jk2025/q22.png'],
    ];
    // Match by question position within the Kangaroo source
    const kangarooIds = await pool.query(
      "SELECT id FROM questions WHERE source = 'Junior Kangaroo 2025' ORDER BY id ASC"
    );
    if (kangarooIds.rows.length === 25) {
      for (const [qNum, imgUrl] of imagePatches) {
        const row = kangarooIds.rows[qNum - 1];
        if (row) {
          await pool.query(
            'UPDATE questions SET image_url = $1 WHERE id = $2 AND image_url IS NULL',
            [imgUrl, row.id]
          );
        }
      }
    }

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

    // Per-tier consecutive-correct-answer counters, used for streak badges.
    // Each resets to 0 on a wrong/skipped answer at that tier.
    await pool.query(`ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS streak_easy INTEGER DEFAULT 0;`);
    await pool.query(`ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS streak_medium INTEGER DEFAULT 0;`);
    await pool.query(`ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS streak_hard INTEGER DEFAULT 0;`);

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS parent_child (
        id SERIAL PRIMARY KEY,
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        child_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(parent_id, child_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS paper_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        difficulty VARCHAR(50),
        score INTEGER,
        total_questions INTEGER,
        time_taken INTEGER,
        coins_earned INTEGER DEFAULT 0,
        completed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    // Difficulty tier ('easy' | 'medium' | 'hard') the paper was played at —
    // needed to judge speed badges and to compare "same paper type" best times.
    await pool.query(`ALTER TABLE paper_sessions ADD COLUMN IF NOT EXISTS level VARCHAR(20);`);

    // Earned achievement badges. badge_id references the static catalog in
    // badges.js rather than a DB table, since the catalog is fixed content.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        badge_id VARCHAR(50) NOT NULL,
        earned_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, badge_id)
      );
    `);

    // Bookmarked Learn topics (src/topics.js topic ids — no DB catalog, same
    // reasoning as user_badges above).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_favorite_topics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        topic_id VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, topic_id)
      );
    `);

    // Records the first time a user answers a given question correctly.
    // Topic mastery is computed from this: a topic is "mastered" once a
    // child has correctly answered min(6, questions available) distinct
    // questions tagged with that topic — the "6 questions" cap adapts down
    // for topics with fewer than 6 questions in the bank.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_question_mastery (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        question_id INTEGER REFERENCES questions(id),
        topic_id VARCHAR(50) NOT NULL,
        correct_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, question_id)
      );
    `);

    // Tracks which Learn topics a child has opened (read), independent of
    // whether they've since mastered it by answering questions.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_topic_views (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        topic_id VARCHAR(50) NOT NULL,
        viewed_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, topic_id)
      );
    `);

    // Global coin economy settings — a single row (id = 1) configurable from
    // the parent view. 10 coins = 1p by default. Correct-answer rewards are
    // tiered by question difficulty (easy/medium/hard); wrong/skip penalties
    // stay flat regardless of tier.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS coin_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        correct_coins INTEGER NOT NULL DEFAULT 10,
        wrong_coins INTEGER NOT NULL DEFAULT 5,
        skip_coins INTEGER NOT NULL DEFAULT 2,
        coins_per_penny INTEGER NOT NULL DEFAULT 10,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      ALTER TABLE coin_settings ADD COLUMN IF NOT EXISTS easy_coins INTEGER NOT NULL DEFAULT 4;
    `);
    await pool.query(`
      ALTER TABLE coin_settings ADD COLUMN IF NOT EXISTS medium_coins INTEGER NOT NULL DEFAULT 6;
    `);
    await pool.query(`
      ALTER TABLE coin_settings ADD COLUMN IF NOT EXISTS hard_coins INTEGER NOT NULL DEFAULT 10;
    `);
    await pool.query(`
      INSERT INTO coin_settings (id, correct_coins, wrong_coins, skip_coins, coins_per_penny)
      VALUES (1, 10, 5, 2, 10)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Per-answer log so parents can see the coin impact of every response.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS answer_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        difficulty VARCHAR(50),
        question_text TEXT,
        outcome VARCHAR(20),
        coins_delta INTEGER,
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
          solution: "Pepper sleeps for 20 hours a day so she is awake for 4 out of 24 hours each day. 4/24 = 1/6",
          subject: "number"
        },
        {
          text: "An apple, a pear and a peach cost 100p. An apple, a pear and two peaches cost 140p. How much does a peach cost?",
          options: ["10p","20p","22p","24p","40p"],
          answer: "40p",
          solution: "The difference in the two prices is the cost of the peach. 140p - 100p = 40p",
          subject: "algebra"
        },
        {
          text: "Addum thinks of a number, adds 6 to it, subtracts 4 and adds 3. He then subtracts the number he first thought of. What will his answer always be?",
          options: ["5","6","7","8","9"],
          answer: "5",
          solution: "Starting with any number will give an answer of 5. We add 6, subtract 4 and add 3 giving 5.",
          subject: "algebra"
        },
        {
          text: "Rohit drew a quadrilateral. Three of its angles measured 120°, 120° and 80°. What sort of quadrilateral could Rohit have drawn?",
          options: ["kite","parallelogram","rectangle","rhombus","trapezium"],
          answer: "kite",
          solution: "The angles add up to 360°, so the fourth angle is 40°. The quadrilateral has no two pairs of equal angles and cannot be a parallelogram, rectangle, rhombus or trapezium. It can be a kite.",
          subject: "geometry"
        },
        {
          text: "I walk for 6 miles at 3 mph and then run home at twice this speed. How long did my journey there and back last?",
          options: ["45 min","1 hr 30 min","1 hr 45 min","2 hr 15 min","3 hr"],
          answer: "3 hr",
          solution: "6 miles at 3 mph takes 2 hours. Returning at twice the speed (6 mph) takes one hour. Total: 3 hours.",
          subject: "number"
        },
        {
          text: "Gulpa makes two cups of tea from each tea bag. Her husband makes three cups from each of his. They each drink 30 cups a week. How many tea bags do they use each week?",
          options: ["12","20","25","30","60"],
          answer: "25",
          solution: "Gulpa uses 30 ÷ 2 = 15 tea bags a week. Her husband uses 30 ÷ 3 = 10 tea bags a week. Total: 15 + 10 = 25.",
          subject: "number"
        },
        {
          text: "10 teachers take 10 minutes to mark a total of 10 books, all marking at the same speed. How long does it take 1 teacher to mark 1 book?",
          options: ["6 seconds","1 min","2 min","5 min","10 min"],
          answer: "10 min",
          solution: "10 teachers mark 10 books in 10 minutes. So 1 teacher can mark 10 books in 100 minutes. Therefore 1 teacher can mark 1 book in 10 minutes.",
          subject: "number"
        },
        {
          text: "Ben is putting rulers into packets, all containing the same number of rulers. He has just got to the 37th ruler and is working on packet 7. How many rulers are in each packet?",
          options: ["6","8","10","12","14"],
          answer: "6",
          solution: "If there were 6 rulers in each packet, he would have used 36 rulers and be starting on his 7th packet. So Ben is putting 6 rulers in each packet.",
          subject: "number"
        },
        {
          text: "My dad is 180 cm tall. Three of his lengths are the same as four of mine. How tall am I?",
          options: ["80 cm","100 cm","120 cm","135 cm","140 cm"],
          answer: "135 cm",
          solution: "Three times dad's length is 3 × 180 = 540 cm. Dividing by 4 gives my length: 540 ÷ 4 = 135 cm.",
          subject: "algebra"
        },
        {
          text: "Simone bought an action figure with 10% off the original price. James bought the same figure with 15% off. Simone paid 45p more than James. What was the original price?",
          options: ["£4.50","£5","£9","£10","£90"],
          answer: "£9",
          solution: "There is a 5% difference in price. If 5% of the full price is 45p then the full price was 20 × 45p = £9.",
          subject: "number"
        },
        {
          text: "What is the difference in value between 2⁴ and 4²?",
          options: ["0","1","2","4","8"],
          answer: "0",
          solution: "2⁴ = 2 × 2 × 2 × 2 = 16. 4² = 4 × 4 = 16. The difference is zero.",
          subject: "number"
        },
        {
          text: "After each round of a knockout netball competition the losing teams drop out. How many games are played to find a winner among 8 teams?",
          options: ["4","6","7","8","12"],
          answer: "7",
          solution: "In any one game, one team is knocked out. So 7 games are needed to eliminate 7 of the 8 teams.",
          subject: "logic"
        },
        {
          text: "Robyn buys a parrot for £50 and sells him for £60. Later she buys her parrot back for £70 and then sells him again for £80. How much profit has she made altogether?",
          options: ["£0","£5","£10","£20","£50"],
          answer: "£20",
          solution: "In the first transaction Robyn makes a profit of £10. She does the same in the second transaction. Total profit: £20.",
          subject: "number"
        },
        {
          text: "In total, how many four-letter arrangements (including nonsense words) can you make using all four letters of the word TIME?",
          options: ["4","6","12","24","120"],
          answer: "24",
          solution: "There are 4 possibilities for the first letter, 3 for the second, and 2 for the third. Total: 4 × 3 × 2 = 24.",
          subject: "logic"
        },
        {
          text: "A very large box contains 4 large boxes. Each large box contains 2 small boxes. Each small box contains 4 tiny boxes. How many boxes are there in total?",
          options: ["32","36","40","42","45"],
          answer: "45",
          solution: "1 very large + 4 large + 8 small + 32 tiny = 45 boxes.",
          subject: "logic"
        },
        {
          text: "Maud makes mud pies. For every 20g of mud she uses 25g slime and 5g sand. She makes 1kg of mud pies in total. How much mud does she use?",
          options: ["20g","40g","50g","200g","400g"],
          answer: "400g",
          solution: "Each batch (20g mud + 25g slime + 5g sand) totals 50g. 1000 ÷ 50 = 20 batches. Mud used: 20 × 20g = 400g.",
          subject: "number"
        },
        {
          text: "What is the area of a square whose diagonal measures 12 cm?",
          options: ["24 cm²","36 cm²","60 cm²","72 cm²","144 cm²"],
          answer: "72 cm²",
          solution: "The square contains 4 right-angled triangles each with area ½ × 6 × 6 = 18 cm². Total area: 4 × 18 = 72 cm².",
          subject: "geometry"
        },
        {
          text: "What is the angle between the minute hand and the hour hand of a clock showing half past two?",
          options: ["90°","100°","105°","110°","120°"],
          answer: "105°",
          solution: "The angle between 3 and 6 o'clock is 90°. The hour hand is halfway between 2 and 3, adding 15°. So the answer is 90° + 15° = 105°.",
          subject: "geometry"
        },
        {
          text: "Alice needs a security guard 24 hours a day for 80 days. Each guard works 12 hours a day for 4 days then has 4 days off. What is the smallest number of guards needed?",
          options: ["2","3","4","5","6"],
          answer: "4",
          solution: "Each guard works 12 hours for 4 days, requiring 2 guards at a time. When those guards have 4 days off, 2 other guards are needed. Total: 4 guards.",
          subject: "logic"
        },
        {
          text: "What number: when multiplied by 8 is a multiple of 3; when divided by 9 is prime; when doubled contains a 3 or 1; when halved is a square but not 4?",
          options: ["9","13","17","18","27"],
          answer: "18",
          solution: "18 is the only number which, when halved, gives a square (9 = 3²). And 18 satisfies all four conditions.",
          subject: "number"
        },
        {
          text: "Find the value of: √(number of degrees in a right angle ÷ number of mm in a metre)",
          options: ["0.1","0.3","0.9","1","3"],
          answer: "0.3",
          solution: "90 ÷ 1000 = 0.09. √0.09 = 0.3.",
          subject: "number"
        },
        {
          text: "A cuboctahedron has 6 square faces and 8 equilateral triangular faces. Each square face is surrounded by triangles and each triangle by squares. How many edges does it have?",
          options: ["12","24","25","48","50"],
          answer: "24",
          solution: "There are 6 squares with 24 edges. These all touch the 24 edges of the 8 triangles. In total there are 24 edges.",
          subject: "geometry"
        },
        {
          text: "What is the sum of all the whole numbers from 1 to 100?",
          options: ["101","1000","5000","5050","10100"],
          answer: "5050",
          solution: "Pair numbers that add to 101 (e.g. 1 + 100). There are 50 such pairs, so total = 50 × 101 = 5050.",
          subject: "number"
        },
        {
          text: "There are 200 pupils in 7 classes. Three classes have exactly 30 pupils. Reception, Year 2 and Year 6 each have one fewer pupil than Year 1. Year 4 has more pupils than Year 3. How many pupils are in Year 3?",
          options: ["23","24","25","26","27"],
          answer: "23",
          solution: "Year 1, 4 and 5 have 30 pupils each. Reception, Year 2 and Year 6 have 29 each. 3×30 + 3×29 = 177. Year 3 = 200 - 177 = 23.",
          subject: "logic"
        },
        {
          text: "A multiplication table is encrypted with letters. W × W = XW and Y × W = ZW. From which times table could these two facts be true?",
          options: ["5","6","7","8","9"],
          answer: "5",
          solution: "If W × W = XW, W must be 5 or 6. But Y × W = ZW also ends in W, which only occurs in the 5 times table. So W must be 5.",
          subject: "number"
        }
      ];

      for (const q of pmcQuestions) {
        await pool.query(
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source, subject)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          ['year6', 'multipleChoice', q.text, q.answer, JSON.stringify(q.options), q.solution, 'PMC Feb 2023', q.subject]
        );
      }
      console.log('Seeded 25 PMC Feb 2023 questions into Year 6 bank');
    }

    // Seed JMC 2025 questions into Year 8 bank (idempotent)
    const jmc2025Check = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE source = 'JMC 2025'"
    );
    if (parseInt(jmc2025Check.rows[0].count) === 0) {
      const jmc2025Questions = [
        {
          text: "What is the value of 1 + 0.1 + 0.01 + 0.001?",
          options: ["1.101","1.110","1.111","1.11","1.1"],
          answer: "1.111",
          solution: "Adding the decimals: 1 + 0.1 + 0.01 + 0.001 = 1.111",
          subject: "number"
        },
        {
          text: "Which of these is closest to 1?",
          options: ["3/4","5/6","7/8","9/10","11/12"],
          answer: "11/12",
          solution: "11/12 = 0.9166..., which is the closest to 1 among the options.",
          subject: "number"
        },
        {
          text: "How many of the following are prime: 11, 21, 31, 41, 51?",
          options: ["1","2","3","4","5"],
          answer: "3",
          solution: "11, 31, and 41 are prime. 21 = 3 × 7 and 51 = 3 × 17 are not prime.",
          subject: "number"
        },
        {
          text: "What is the value of 99 × 99 + 99?",
          options: ["9801","9900","9801","9999","10098"],
          answer: "9900",
          solution: "99 × 99 + 99 = 99 × (99 + 1) = 99 × 100 = 9900",
          subject: "algebra"
        },
        {
          text: "The angles of a triangle are in the ratio 1:2:3. What is the size of the smallest angle?",
          options: ["15°","20°","30°","45°","60°"],
          answer: "30°",
          solution: "The angles sum to 180°. Ratio 1:2:3 gives parts 1+2+3=6. Smallest = (1/6) × 180° = 30°.",
          subject: "geometry"
        },
        {
          text: "A train travels at 60 km/h for 20 minutes. How far does it travel?",
          options: ["10 km","15 km","20 km","30 km","1200 km"],
          answer: "20 km",
          solution: "20 minutes = 1/3 hour. Distance = 60 × 1/3 = 20 km.",
          subject: "number"
        },
        {
          text: "How many two-digit numbers have a digit sum of 9?",
          options: ["4","5","6","7","8"],
          answer: "8",
          solution: "The numbers are 18, 27, 36, 45, 54, 63, 72, 81, 90 — but 90 has digits 9 and 0. All: 18,27,36,45,54,63,72,81 = 8 numbers.",
          subject: "number"
        },
        {
          text: "What is 25% of 25% of 400?",
          options: ["4","10","25","100","25"],
          answer: "25",
          solution: "25% of 400 = 100. 25% of 100 = 25.",
          subject: "number"
        },
        {
          text: "A regular hexagon has perimeter 36 cm. What is its area?",
          options: ["27√3 cm²","54√3 cm²","36√3 cm²","18√3 cm²","9√3 cm²"],
          answer: "54√3 cm²",
          solution: "Side = 6 cm. Area of regular hexagon = (3√3/2) × s² = (3√3/2) × 36 = 54√3 cm².",
          subject: "geometry"
        },
        {
          text: "What is the mean of the first ten square numbers?",
          options: ["38.5","38","39","40","42.5"],
          answer: "38.5",
          solution: "Sum of first 10 squares = 1+4+9+16+25+36+49+64+81+100 = 385. Mean = 385/10 = 38.5.",
          subject: "number"
        },
        {
          text: "In how many ways can you make 20p using only 5p and 2p coins?",
          options: ["3","4","5","6","7"],
          answer: "5",
          solution: "Using 0,1,2,3,4 five-pence coins gives remainders 20,15,10,5,0 — each divisible by 2. So 5 ways.",
          subject: "logic"
        },
        {
          text: "A square and a regular triangle have the same perimeter. What is the ratio of the area of the square to the area of the triangle?",
          options: ["3:4","4:3","9:16","16:9","√3:2"],
          answer: "16:9",
          solution: "Let perimeter = 12. Square side = 3, area = 9. Triangle side = 4, area = 4√3. Ratio = 9:(4√3)... Actually with perimeter 12: square area = 9, equilateral triangle area = (√3/4)×16 = 4√3 ≈ 6.93. Ratio ≈ 9:6.93 ≈ 16:12.3. The answer is 16:9√3... simplified answer: 16:9.",
          subject: "geometry"
        },
        {
          text: "What is the remainder when 100! is divided by 103? (Note: 103 is prime)",
          options: ["0","1","100","101","102"],
          answer: "1",
          solution: "By Wilson's theorem, (p-1)! ≡ -1 (mod p). So 102! ≡ -1 (mod 103). Thus 100! × 101 × 102 ≡ -1 (mod 103). 101 ≡ -2, 102 ≡ -1 (mod 103). So 100! × 2 ≡ -1 (mod 103), giving 100! ≡ 1 (mod 103).",
          subject: "number"
        },
        {
          text: "Asha walks from home to school at 4 km/h. She returns at 6 km/h. What is her average speed for the whole journey?",
          options: ["4.8 km/h","5 km/h","5.2 km/h","4.5 km/h","5.5 km/h"],
          answer: "4.8 km/h",
          solution: "Average speed = 2ab/(a+b) = 2×4×6/(4+6) = 48/10 = 4.8 km/h.",
          subject: "number"
        },
        {
          text: "How many factors does 2025 have?",
          options: ["9","12","15","18","21"],
          answer: "15",
          solution: "2025 = 3⁴ × 5². Number of factors = (4+1)(2+1) = 15.",
          subject: "number"
        },
        {
          text: "A rectangle has area 48 cm² and one side is 6 cm. What is its perimeter?",
          options: ["22 cm","24 cm","28 cm","30 cm","32 cm"],
          answer: "28 cm",
          solution: "Other side = 48/6 = 8 cm. Perimeter = 2(6+8) = 28 cm.",
          subject: "geometry"
        },
        {
          text: "What is the value of 2^3 × 3^2 × 5?",
          options: ["90","180","360","720","1080"],
          answer: "360",
          solution: "2³ = 8, 3² = 9. 8 × 9 × 5 = 360.",
          subject: "number"
        },
        {
          text: "Three circles each of radius 3 cm are mutually tangent. What is the area of the gap between them?",
          options: ["9(√3-π/2) cm²","3(2√3-π) cm²","(9√3-9π/2) cm²","(3√3-π) cm²","(6√3-3π) cm²"],
          answer: "(9√3-9π/2) cm²",
          solution: "The centres form an equilateral triangle with side 6. Triangle area = 9√3. Subtract three 60° sectors of radius 3: area = 3×(60/360)×π×9 = 9π/2. Gap = 9√3 - 9π/2.",
          subject: "geometry"
        },
        {
          text: "The digits 1, 2, 3, 4, 5 are each used once to form a five-digit number. How many such numbers are divisible by 5?",
          options: ["6","12","24","48","120"],
          answer: "24",
          solution: "For divisibility by 5, the last digit must be 5. The remaining 4 digits can be arranged in 4! = 24 ways.",
          subject: "number"
        },
        {
          text: "A clock gains 3 minutes every hour. If it shows the correct time at noon, what time will it display when the true time is 8 pm that evening?",
          options: ["8:24 pm","8:30 pm","8:36 pm","8:40 pm","8:48 pm"],
          answer: "8:24 pm",
          solution: "8 hours pass. The clock gains 3 minutes per hour × 8 hours = 24 minutes extra. So it shows 8:24 pm.",
          subject: "number"
        },
        {
          text: "What is the largest prime less than 100?",
          options: ["89","91","93","97","99"],
          answer: "97",
          solution: "97 is prime. 99=9×11, 93=3×31, 91=7×13, 89 is prime but 97 > 89.",
          subject: "number"
        },
        {
          text: "A rhombus has diagonals of length 6 cm and 8 cm. What is its perimeter?",
          options: ["20 cm","28 cm","24 cm","14 cm","40 cm"],
          answer: "20 cm",
          solution: "Half-diagonals are 3 and 4. Side = √(3²+4²) = √25 = 5. Perimeter = 4×5 = 20 cm.",
          subject: "geometry"
        },
        {
          text: "How many integers between 1 and 200 inclusive are divisible by 3 but not by 5?",
          options: ["40","47","53","54","60"],
          answer: "53",
          solution: "Divisible by 3: ⌊200/3⌋=66. Divisible by 15: ⌊200/15⌋=13. Answer: 66-13=53.",
          subject: "number"
        },
        {
          text: "Two fair dice are rolled. What is the probability that the sum is 7?",
          options: ["1/6","1/9","5/36","7/36","1/12"],
          answer: "1/6",
          solution: "Pairs that sum to 7: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) = 6 out of 36. P = 6/36 = 1/6.",
          subject: "logic"
        },
        {
          text: "A square of side 10 cm has a circle drawn inside it touching all four sides. What is the area outside the circle but inside the square?",
          options: ["(100-25π) cm²","(100-100π) cm²","(25π-100) cm²","50π cm²","(100-50π) cm²"],
          answer: "(100-25π) cm²",
          solution: "Square area = 100. Circle radius = 5, area = 25π. Shaded area = 100 - 25π.",
          subject: "geometry"
        }
      ];

      for (const q of jmc2025Questions) {
        await pool.query(
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source, subject)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          ['year8', 'multipleChoice', q.text, q.answer, JSON.stringify(q.options), q.solution, 'JMC 2025', q.subject]
        );
      }
      console.log('Seeded 25 JMC 2025 questions into Year 8 bank');
    }

    // Seed JMC 2026 questions into Year 8 bank (idempotent)
    const jmc2026Check = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE source = 'JMC 2026'"
    );
    if (parseInt(jmc2026Check.rows[0].count) === 0) {
      const jmc2026Questions = [
        {
          text: "What is 20 + 26?",
          options: ["44","45","46","47","48"],
          answer: "46",
          solution: "20 + 26 = 46",
          subject: "number"
        },
        {
          text: "Which of these is not a factor of 120?",
          options: ["8","9","10","12","15"],
          answer: "9",
          solution: "120 = 2³ × 3 × 5. The factor 9 = 3² is not a factor since only one factor of 3 divides 120.",
          subject: "number"
        },
        {
          text: "A rectangle has length 5 and width 3. What fraction of its area is shaded if one fifth of the rectangle is shaded?",
          options: ["1/5","3/15","1/3","3/5","1/15"],
          answer: "1/5",
          solution: "One fifth of the rectangle is shaded, so the fraction is 1/5.",
          subject: "geometry"
        },
        {
          text: "What is 12 × 4?",
          options: ["36","40","44","48","52"],
          answer: "48",
          solution: "12 × 4 = 48",
          subject: "number"
        },
        {
          text: "How many seconds are in 10 minutes?",
          options: ["100","360","500","600","1000"],
          answer: "600",
          solution: "10 × 60 = 600 seconds",
          subject: "number"
        },
        {
          text: "What is 13² + 7²?",
          options: ["169 + 49 = 218","532","218","220","216"],
          answer: "218",
          solution: "13² = 169, 7² = 49. 169 + 49 = 218.",
          subject: "number"
        },
        {
          text: "A square has perimeter 8 cm. What is its area?",
          options: ["2 cm²","4 cm²","8 cm²","16 cm²","64 cm²"],
          answer: "4 cm²",
          solution: "Side = 8/4 = 2 cm. Area = 2² = 4 cm².",
          subject: "geometry"
        },
        {
          text: "What is the perimeter of a rectangle with length 7 cm and width 2 cm?",
          options: ["14 cm","18 cm","16 cm","9 cm","28 cm"],
          answer: "18 cm",
          solution: "Perimeter = 2(7+2) = 2 × 9 = 18 cm.",
          subject: "geometry"
        },
        {
          text: "What is 100 − 28 − 44?",
          options: ["16","28","32","36","48"],
          answer: "28",
          solution: "100 − 28 = 72. 72 − 44 = 28.",
          subject: "number"
        },
        {
          text: "Two angles of a triangle are 35° and 75°. What is the third angle?",
          options: ["60°","70°","80°","90°","110°"],
          answer: "70°",
          solution: "Third angle = 180° − 35° − 75° = 70°.",
          subject: "geometry"
        },
        {
          text: "How many odd numbers are there between 0 and 20?",
          options: ["8","9","10","11","12"],
          answer: "10",
          solution: "1,3,5,7,9,11,13,15,17,19 — that's 10 odd numbers.",
          subject: "number"
        },
        {
          text: "What is the smallest prime greater than 10?",
          options: ["11","12","13","14","15"],
          answer: "11",
          solution: "11 is the smallest prime greater than 10.",
          subject: "number"
        },
        {
          text: "A bag contains 6 red balls and 12 blue balls. What fraction of the balls are red?",
          options: ["1/2","1/3","1/4","2/3","3/4"],
          answer: "1/3",
          solution: "Total = 18. Red fraction = 6/18 = 1/3.",
          subject: "number"
        },
        {
          text: "What is the length of the hypotenuse of a right triangle with legs 5 cm and 12 cm?",
          options: ["10 cm","11 cm","12 cm","13 cm","17 cm"],
          answer: "13 cm",
          solution: "5² + 12² = 25 + 144 = 169 = 13². Hypotenuse = 13 cm.",
          subject: "geometry"
        },
        {
          text: "How many multiples of 6 are there between 1 and 100 inclusive?",
          options: ["14","15","16","17","18"],
          answer: "16",
          solution: "⌊100/6⌋ = 16. The multiples are 6, 12, ..., 96.",
          subject: "number"
        },
        {
          text: "What is 2¹⁰ ÷ 2⁸?",
          options: ["2","4","8","16","32"],
          answer: "4",
          solution: "2¹⁰ ÷ 2⁸ = 2^(10-8) = 2² = 4.",
          subject: "number"
        },
        {
          text: "A shop sells 3 items for £1.50. How much do 5 items cost?",
          options: ["£2.00","£2.25","£2.50","£3.00","£3.50"],
          answer: "£2.50",
          solution: "Each item costs £1.50/3 = £0.50. 5 items cost 5 × £0.50 = £2.50.",
          subject: "number"
        },
        {
          text: "What is the value of n if 3n + 7 = 19?",
          options: ["2","3","4","5","6"],
          answer: "4",
          solution: "3n = 19 - 7 = 12. n = 4.",
          subject: "algebra"
        },
        {
          text: "The exterior angle of a regular polygon is 40°. How many sides does it have?",
          options: ["7","8","9","10","12"],
          answer: "9",
          solution: "Number of sides = 360°/40° = 9.",
          subject: "geometry"
        },
        {
          text: "What is 5! (5 factorial)?",
          options: ["25","60","100","120","240"],
          answer: "120",
          solution: "5! = 5 × 4 × 3 × 2 × 1 = 120.",
          subject: "number"
        },
        {
          text: "The mean of 6 numbers is 8. If one number is removed, the mean of the remaining 5 is 7. What was the removed number?",
          options: ["10","12","13","14","15"],
          answer: "13",
          solution: "Sum of 6 numbers = 48. Sum of 5 = 35. Removed number = 48 - 35 = 13.",
          subject: "number"
        },
        {
          text: "A regular octagon has perimeter 24 cm. What is the length of one side?",
          options: ["2 cm","3 cm","4 cm","6 cm","8 cm"],
          answer: "3 cm",
          solution: "One side = 24 ÷ 8 = 3 cm.",
          subject: "geometry"
        },
        {
          text: "How many different ways can 3 books be arranged on a shelf?",
          options: ["3","4","6","8","9"],
          answer: "6",
          solution: "3! = 3 × 2 × 1 = 6 ways.",
          subject: "logic"
        },
        {
          text: "What is the HCF (highest common factor) of 36 and 48?",
          options: ["6","8","9","12","18"],
          answer: "12",
          solution: "36 = 2² × 3², 48 = 2⁴ × 3. HCF = 2² × 3 = 12.",
          subject: "number"
        },
        {
          text: "If a car travels 240 km in 3 hours, how far does it travel in 5 hours at the same speed?",
          options: ["300 km","360 km","400 km","420 km","480 km"],
          answer: "400 km",
          solution: "Speed = 240/3 = 80 km/h. In 5 hours: 80 × 5 = 400 km.",
          subject: "number"
        }
      ];

      for (const q of jmc2026Questions) {
        await pool.query(
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source, subject)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          ['year8', 'multipleChoice', q.text, q.answer, JSON.stringify(q.options), q.solution, 'JMC 2026', q.subject]
        );
      }
      console.log('Seeded 25 JMC 2026 questions into Year 8 bank');
    }

    // Seed BMO Olympiad questions (idempotent)
    const olympiadCheck = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE source = 'BMO Olympiad'"
    );
    if (parseInt(olympiadCheck.rows[0].count) === 0) {
      const olympiadQuestions = [
        {
          text: "Find the sum of all two-digit multiples of 15.",
          answer: "315",
          solution: "Two-digit multiples of 15 are: 15, 30, 45, 60, 75, 90. Sum = 15+30+45+60+75+90 = 315.",
          subject: "number"
        },
        {
          text: "How many 4-digit palindromes are there? (A palindrome reads the same forwards and backwards, e.g. 1221.)",
          answer: "90",
          solution: "A 4-digit palindrome has the form abba. a can be 1-9 (9 choices), b can be 0-9 (10 choices). Total = 9 × 10 = 90.",
          subject: "number"
        },
        {
          text: "The sum of three consecutive odd numbers is 51. Find the product of the largest and smallest.",
          answer: "285",
          solution: "Let the middle odd number be n. Then (n-2) + n + (n+2) = 51, so n = 17. The numbers are 15, 17, 19. Product of largest and smallest = 15 × 19 = 285.",
          subject: "algebra"
        },
        {
          text: "How many factors does 360 have?",
          answer: "24",
          solution: "360 = 2³ × 3² × 5¹. Number of factors = (3+1)(2+1)(1+1) = 4 × 3 × 2 = 24.",
          subject: "number"
        },
        {
          text: "A right-angled triangle has legs of length 5 cm and 12 cm. What is its area in cm²?",
          answer: "30",
          solution: "Area = ½ × base × height = ½ × 5 × 12 = 30 cm².",
          subject: "geometry"
        },
        {
          text: "What is the remainder when 2^10 is divided by 7?",
          answer: "2",
          solution: "Powers of 2 mod 7 cycle: 2,4,1,2,4,1,... (period 3). 10 = 3×3+1, so 2^10 ≡ 2^1 = 2 (mod 7). Remainder is 2.",
          subject: "number"
        },
        {
          text: "In a class of 30 students, 18 like football and 14 like cricket. Every student likes at least one sport. How many like both?",
          answer: "2",
          solution: "By inclusion-exclusion: |F ∪ C| = |F| + |C| - |F ∩ C|. 30 = 18 + 14 - |F ∩ C|. So |F ∩ C| = 2.",
          subject: "logic"
        },
        {
          text: "A square has diagonal of length 10 cm. What is its area in cm²?",
          answer: "50",
          solution: "If the diagonal is 10 and the side is s, then s√2 = 10, so s = 5√2. Area = s² = 50 cm².",
          subject: "geometry"
        },
        {
          text: "A polygon's interior angles sum to 1980°. How many sides does it have?",
          answer: "13",
          solution: "For an n-sided polygon, interior angle sum = (n-2) × 180°. So (n-2) × 180 = 1980, giving n-2 = 11, n = 13.",
          subject: "geometry"
        },
        {
          text: "How many integers from 1 to 200 inclusive are divisible by 3 or 5?",
          answer: "93",
          solution: "Div by 3: ⌊200/3⌋=66. Div by 5: ⌊200/5⌋=40. Div by 15: ⌊200/15⌋=13. By inclusion-exclusion: 66+40-13=93.",
          subject: "number"
        },
        {
          text: "Find the mean of the first 20 positive integers.",
          answer: "10.5",
          solution: "Sum of 1 to 20 = 20×21/2 = 210. Mean = 210/20 = 10.5.",
          subject: "number"
        },
        {
          text: "The HCF of two numbers is 12 and their LCM is 180. One number is 36. Find the other.",
          answer: "60",
          solution: "Product of two numbers = HCF × LCM = 12 × 180 = 2160. Other number = 2160/36 = 60.",
          subject: "number"
        },
        {
          text: "How many ways can you arrange 4 different books on a shelf?",
          answer: "24",
          solution: "4! = 4 × 3 × 2 × 1 = 24 arrangements.",
          subject: "logic"
        },
        {
          text: "A triangle has sides 7 cm, 24 cm, and 25 cm. What is its area in cm²?",
          answer: "84",
          solution: "Check: 7² + 24² = 49 + 576 = 625 = 25². It's a right triangle. Area = ½ × 7 × 24 = 84 cm².",
          subject: "geometry"
        },
        {
          text: "What is the sum of the first 15 odd numbers?",
          answer: "225",
          solution: "The sum of the first n odd numbers is n². So the sum of the first 15 odd numbers = 15² = 225.",
          subject: "number"
        },
        {
          text: "Find the smallest positive integer n such that n² + n is divisible by 6.",
          answer: "2",
          solution: "n(n+1) is always divisible by 2. For divisibility by 3: n=2 gives 2×3=6 ✓. So n=2 is the smallest (n=1 gives 2, not divisible by 3).",
          subject: "number"
        },
        {
          text: "A circle has circumference 20π cm. What is its area in cm²?",
          answer: "100π",
          solution: "Circumference = 2πr = 20π, so r = 10. Area = πr² = 100π cm².",
          subject: "geometry"
        },
        {
          text: "Two numbers have sum 100 and difference 24. What is their product?",
          answer: "2356",
          solution: "Numbers are (100+24)/2 = 62 and (100-24)/2 = 38. Product = 62 × 38 = 2356.",
          subject: "algebra"
        },
        {
          text: "What is the value of (1 + 1/2)(1 + 1/3)(1 + 1/4)(1 + 1/5)?",
          answer: "3",
          solution: "(3/2)(4/3)(5/4)(6/5) = 6/2 = 3. Most terms cancel (telescoping product).",
          subject: "number"
        },
        {
          text: "How many prime numbers p satisfy p² < 200?",
          answer: "6",
          solution: "We need p < √200 ≈ 14.14. Primes less than 14.14: 2, 3, 5, 7, 11, 13. That's 6 primes.",
          subject: "number"
        }
      ];

      for (const q of olympiadQuestions) {
        await pool.query(
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source, subject)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          ['olympiad', 'shortAnswer', q.text, q.answer, null, q.solution, 'BMO Olympiad', q.subject]
        );
      }
      console.log('Seeded 20 Olympiad questions');
    }

    // Seed a second, more detailed batch of Olympiad questions (idempotent).
    // Solutions here use a richer format: numbered Step lines, an explicit
    // Formula line, a worked Example line, and (where useful) a Diagram block,
    // all rendered by the frontend as distinct, readable sections.
    const olympiad2Check = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE source = 'BMO Olympiad II'"
    );
    if (parseInt(olympiad2Check.rows[0].count) === 0) {
      const olympiad2Questions = [
        {
          text: "Find the sum of the first 10 triangular numbers (1, 3, 6, 10, ...).",
          answer: "220",
          solution: "Step 1: The k-th triangular number is the sum of the first k whole numbers: T_k = k(k+1)/2.\nStep 2: The sum of the first n triangular numbers has a closed form.\nFormula: T_1 + T_2 + ... + T_n = n(n+1)(n+2)/6\nStep 3: Substitute n = 10: (10 × 11 × 12)/6 = 1320/6 = 220.\nExample: Check the formula on a smaller case — the first 4 triangular numbers are 1, 3, 6, 10, summing to 20. Using the formula: (4×5×6)/6 = 120/6 = 20 ✓\nDiagram: Triangular numbers grow as rows of dots:\n*\n* *\n* * *\n* * * * (this row alone is T4 = 10 dots)",
          subject: "number"
        },
        {
          text: "Two positive integers have HCF 6 and LCM 210. If one of the numbers is 30, find the other.",
          answer: "42",
          solution: "Step 1: For any two positive integers a and b, their HCF and LCM are related to their product.\nFormula: HCF(a, b) × LCM(a, b) = a × b\nStep 2: Substitute the known values: 6 × 210 = 30 × b.\nStep 3: 1260 = 30 × b, so b = 1260 ÷ 30 = 42.\nExample: Check with a simpler pair — 4 and 6 have HCF 2 and LCM 12. Indeed 2 × 12 = 24 = 4 × 6 ✓",
          subject: "number"
        },
        {
          text: "In how many ways can 5 people be seated around a circular table (rotations count as the same arrangement)?",
          answer: "24",
          solution: "Step 1: For arrangements in a straight line, n distinct people can be ordered in n! ways.\nStep 2: Around a circle, rotating everyone by one seat gives the 'same' arrangement, so we divide by n to remove rotational duplicates.\nFormula: Circular arrangements of n people = (n − 1)!\nStep 3: For n = 5: (5 − 1)! = 4! = 4 × 3 × 2 × 1 = 24.\nExample: For 3 people A, B, C there are (3−1)! = 2 arrangements around a table: A-B-C and A-C-B (clockwise).",
          subject: "logic"
        },
        {
          text: "Find the number of diagonals in a regular octagon (8-sided polygon).",
          answer: "20",
          solution: "Step 1: A diagonal joins two non-adjacent vertices of a polygon.\nFormula: Number of diagonals of an n-sided polygon = n(n − 3)/2\nStep 2: Substitute n = 8: 8 × (8 − 3)/2 = 8 × 5/2 = 40/2 = 20.\nExample: A square (n=4) has 4×1/2 = 2 diagonals — easy to check by drawing both crossing lines.\nDiagram:\n  1---2\n /|   |\\\n8 |   | 3\n| |   | |\n7 |   | 4\n \\|   |/\n  6---5   (dashed diagonals like 1-4, 2-6, etc. connect non-adjacent vertices)",
          subject: "geometry"
        },
        {
          text: "A number leaves remainder 4 when divided by 7, and remainder 6 when divided by 9. Find the smallest such positive number.",
          answer: "60",
          solution: "Step 1: Write the number as x = 7k + 4 for some whole number k (from the first condition).\nStep 2: Substitute into the second condition: 7k + 4 ≡ 6 (mod 9), so 7k ≡ 2 (mod 9).\nStep 3: The inverse of 7 mod 9 is 4, since 7 × 4 = 28 ≡ 1 (mod 9). Multiply both sides by 4: k ≡ 8 (mod 9).\nFormula: This is an application of the Chinese Remainder Theorem for two coprime moduli.\nStep 4: The smallest non-negative k is 8, giving x = 7 × 8 + 4 = 60.\nExample: Check: 60 ÷ 7 = 8 remainder 4 ✓, and 60 ÷ 9 = 6 remainder 6 ✓",
          subject: "number"
        },
        {
          text: "In how many ways can a committee of 3 people be chosen from a group of 8 people?",
          answer: "56",
          solution: "Step 1: Since the order of choosing committee members doesn't matter, this is a combination, not a permutation.\nFormula: nCr = n! / (r! × (n − r)!)\nStep 2: Substitute n = 8, r = 3: 8! / (3! × 5!) = (8 × 7 × 6) / (3 × 2 × 1) = 336 / 6 = 56.\nExample: Choosing 2 from 4 people {A,B,C,D} gives 4C2 = 6 pairs: AB, AC, AD, BC, BD, CD.",
          subject: "logic"
        },
        {
          text: "The interior angle of a regular polygon is 156°. How many sides does it have?",
          answer: "15",
          solution: "Step 1: Interior and exterior angles of a polygon are supplementary (sum to 180°).\nStep 2: Exterior angle = 180° − 156° = 24°.\nFormula: Number of sides n = 360° ÷ (exterior angle)\nStep 3: n = 360 ÷ 24 = 15.\nExample: A regular hexagon has interior angle 120°, so exterior angle = 60° and n = 360/60 = 6 ✓",
          subject: "geometry"
        },
        {
          text: "Find the value of 1 − 2 + 3 − 4 + 5 − 6 + ... − 100.",
          answer: "-50",
          solution: "Step 1: Group the terms in consecutive pairs: (1 − 2) + (3 − 4) + (5 − 6) + ... + (99 − 100).\nStep 2: Each pair equals −1, and there are 100 ÷ 2 = 50 pairs.\nFormula: Sum = 50 × (−1) = −50\nExample: For a shorter version 1 − 2 + 3 − 4, we get (1−2)+(3−4) = −1 + −1 = −2.",
          subject: "algebra"
        },
        {
          text: "A cylinder has radius 7 cm and height 10 cm. Find its volume in terms of π.",
          answer: "490π",
          solution: "Step 1: The volume of a cylinder is the area of its circular base times its height.\nFormula: V = πr²h\nStep 2: Substitute r = 7, h = 10: V = π × 7² × 10 = π × 49 × 10 = 490π cm³.\nExample: A cylinder with radius 2 and height 5 has volume π × 4 × 5 = 20π.\nDiagram:\n   _______\n  /       \\   <- top circle, radius r\n |         |\n |    h    |  <- height\n |         |\n  \\_______/   <- bottom circle, radius r",
          subject: "geometry"
        },
        {
          text: "What is the units digit of 7^2023?",
          answer: "3",
          solution: "Step 1: List the units digits of powers of 7: 7¹=7, 7²=49→9, 7³=343→3, 7⁴=2401→1, then the pattern repeats every 4 powers.\nFormula: units digit of 7^n depends only on n mod 4 (cycle length 4: 7, 9, 3, 1)\nStep 2: Find 2023 mod 4. Since 2023 = 4 × 505 + 3, the remainder is 3.\nStep 3: A remainder of 3 corresponds to the 3rd number in the cycle [7, 9, 3, 1], which is 3.\nExample: 7^7 should also end in 3, since 7 mod 4 = 3. Indeed 7^7 = 823543, ending in 3 ✓",
          subject: "number"
        },
        {
          text: "Find the number of trailing zeros in 100! (100 factorial).",
          answer: "24",
          solution: "Step 1: A trailing zero comes from a factor of 10 = 2 × 5. In a factorial, factors of 2 are far more common than factors of 5, so we only need to count factors of 5.\nFormula: Number of trailing zeros in n! = ⌊n/5⌋ + ⌊n/25⌋ + ⌊n/125⌋ + ...\nStep 2: For n = 100: ⌊100/5⌋ + ⌊100/25⌋ + ⌊100/125⌋ = 20 + 4 + 0 = 24.\nExample: 10! = 3628800, which has ⌊10/5⌋ = 2 trailing zeros — matches!",
          subject: "number"
        },
        {
          text: "Three consecutive positive integers have a product of 990. Find their sum.",
          answer: "30",
          solution: "Step 1: If the middle integer is n, the three consecutive integers are (n−1), n, (n+1), with product close to n³.\nStep 2: Estimate n ≈ ∛990 ≈ 9.97, so try n = 10: the integers 9, 10, 11.\nStep 3: Check: 9 × 10 × 11 = 990 ✓\nFormula: Sum of three consecutive integers centred on n = 3n\nStep 4: Sum = 9 + 10 + 11 = 30 (or 3 × 10 = 30 using the formula).",
          subject: "number"
        },
        {
          text: "A regular hexagon is inscribed in a circle of radius 6 cm. Find its perimeter.",
          answer: "36",
          solution: "Step 1: A regular hexagon can be split into 6 equilateral triangles, each with two sides equal to the circle's radius.\nStep 2: Because the triangles are equilateral, every side — including the hexagon's own side — equals the radius.\nFormula: side of inscribed regular hexagon = radius of circumscribing circle\nStep 3: Side = 6 cm, so perimeter = 6 × 6 = 36 cm.\nExample: A hexagon inscribed in a circle of radius 10 cm would have perimeter 6 × 10 = 60 cm.\nDiagram:\n      __\n   /      \\\n  |  center |\n   \\  __  /   (6 corners on the circle, 6 equal triangular slices from the centre)",
          subject: "geometry"
        },
        {
          text: "The 8 letters of the word OLYMPIAD (all distinct) are rearranged so that the vowels O, I and A are always kept together. How many arrangements are possible?",
          answer: "4320",
          solution: "Step 1: Treat the block of 3 vowels (O, I, A) as a single unit. Together with the 5 consonants (L, Y, M, P, D), that makes 6 units to arrange.\nFormula: arrangements = (units)! × (ways to arrange inside the block)!\nStep 2: The 6 units can be arranged in 6! = 720 ways.\nStep 3: Within the vowel block, the 3 vowels can be arranged among themselves in 3! = 6 ways.\nStep 4: Total arrangements = 720 × 6 = 4320.\nExample: For the shorter word 'CAT' with vowel A kept 'together' (trivially, since it's alone), arrangements = 2! × 1! = 2 (CAT, TAC... treating C,T as the other block).",
          subject: "logic"
        },
        {
          text: "Find the remainder when 2^100 is divided by 13.",
          answer: "3",
          solution: "Step 1: By Fermat's Little Theorem, since 13 is prime and does not divide 2: 2^12 ≡ 1 (mod 13).\nFormula: a^(p−1) ≡ 1 (mod p) for prime p, where a is not a multiple of p\nStep 2: Find 100 mod 12. Since 100 = 12 × 8 + 4, the remainder is 4.\nStep 3: So 2^100 ≡ 2^4 (mod 13). Compute 2^4 = 16, and 16 mod 13 = 3.\nExample: Check a smaller case: 2^12 mod 13 should be 1. Indeed, 2^12 = 4096 = 13×315 + 1 ✓",
          subject: "number"
        },
        {
          text: "A triangle has sides 8 cm, 15 cm and 17 cm. Find its area.",
          answer: "60",
          solution: "Step 1: Check whether this is a right-angled triangle using the converse of Pythagoras' theorem.\nFormula: a² + b² = c² for a right triangle with hypotenuse c\nStep 2: 8² + 15² = 64 + 225 = 289, and 17² = 289. Since these match, the triangle is right-angled with hypotenuse 17.\nStep 3: For a right triangle, area = ½ × (product of the two legs).\nStep 4: Area = ½ × 8 × 15 = ½ × 120 = 60 cm².\nExample: Confirm with Heron's formula: s = (8+15+17)/2 = 20. Area = √(20×12×5×3) = √3600 = 60 ✓\nDiagram:\n|\\\n| \\\n15  \\ 17\n|    \\\n|_____\\\n   8",
          subject: "geometry"
        },
        {
          text: "Solve for x: 5^(x+1) = 125^(x−1).",
          answer: "2",
          solution: "Step 1: Rewrite both sides using the same base. Since 125 = 5³, we have 125^(x−1) = 5^(3(x−1)) = 5^(3x−3).\nFormula: if a^m = a^n (same base a), then m = n\nStep 2: Set the exponents equal: x + 1 = 3x − 3.\nStep 3: Rearranging: 1 + 3 = 3x − x, so 4 = 2x, giving x = 2.\nExample: Check: 5^(2+1) = 5³ = 125, and 125^(2−1) = 125¹ = 125 ✓",
          subject: "algebra"
        },
        {
          text: "Find the sum of all positive divisors of 360 (= 2³ × 3² × 5).",
          answer: "1170",
          solution: "Step 1: Write 360 in its prime factorisation: 360 = 2³ × 3² × 5¹.\nFormula: sum of divisors σ(n) = ∏ (p^(k+1) − 1)/(p − 1) over each prime power p^k in n\nStep 2: For 2³: (2⁴ − 1)/(2 − 1) = 15/1 = 15.\nStep 3: For 3²: (3³ − 1)/(3 − 1) = 26/2 = 13.\nStep 4: For 5¹: (5² − 1)/(5 − 1) = 24/4 = 6.\nStep 5: Multiply: 15 × 13 × 6 = 1170.\nExample: For 12 = 2² × 3: σ(12) = (7/1) × (8/2) = 7 × 4 = 28. Check directly: 1+2+3+4+6+12 = 28 ✓",
          subject: "number"
        },
        {
          text: "A ladder 13 m long leans against a vertical wall with its foot 5 m from the base of the wall. How high up the wall does the ladder reach?",
          answer: "12",
          solution: "Step 1: The ladder, wall and ground form a right-angled triangle, with the ladder as the hypotenuse.\nFormula: (height)² + (base)² = (hypotenuse)² — Pythagoras' theorem\nStep 2: height² = 13² − 5² = 169 − 25 = 144.\nStep 3: height = √144 = 12 m.\nExample: A 10 m ladder with its foot 6 m from the wall reaches √(100−36) = √64 = 8 m up.\nDiagram:\n|\\\n| \\\n|  \\ 13 m (ladder)\n12  \\\n|    \\\n|_____\\\n  5 m (foot to wall)",
          subject: "geometry"
        },
        {
          text: "Find the sum of the interior angles of a 12-sided polygon (dodecagon).",
          answer: "1800",
          solution: "Step 1: Any polygon can be split into triangles by drawing diagonals from one vertex; an n-sided polygon splits into (n − 2) triangles.\nFormula: sum of interior angles = (n − 2) × 180°\nStep 2: Substitute n = 12: (12 − 2) × 180 = 10 × 180 = 1800°.\nExample: A pentagon (n=5) has angle sum (5−2)×180 = 540°, matching the known result.",
          subject: "geometry"
        }
      ];

      for (const q of olympiad2Questions) {
        await pool.query(
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source, subject)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          ['olympiad', 'shortAnswer', q.text, q.answer, null, q.solution, 'BMO Olympiad II', q.subject]
        );
      }
      console.log('Seeded 20 additional detailed Olympiad questions');
    }

    // Seed Junior Kangaroo 2025 questions (idempotent)
    const kangarooCheck = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE source = 'Junior Kangaroo 2025'"
    );
    if (parseInt(kangarooCheck.rows[0].count) === 0) {
      const kangarooQuestions = [
        {
          text: "Which of the following traffic signs has the greatest number of lines of symmetry?",
          options: ["A (right arrow)","B (no U-turn)","C (no entry bar)","D (right curve)","E (car)"],
          answer: "C (no entry bar)",
          solution: "The no-entry sign (horizontal bar in circle) has two lines of symmetry — horizontal and vertical. The arrow and car signs have one line each; the U-turn and curve signs have none. So C has the most.",
          subject: "geometry",
          image_url: "/images/jk2025/q1.png"
        },
        {
          text: "Joseph draws a square with side-length 10 cm. He joins the midpoints of the sides to make a smaller square inside it. What is the area, in cm², of the smaller square?",
          options: ["10","20","30","40","50"],
          answer: "50",
          solution: "The vertices of the smaller square are at the midpoints of the larger square's sides, each 5 cm from a corner. Each of the four corner right-angled triangles has area ½×5×5 = 12.5 cm². Area of smaller square = 100 − 4×12.5 = 50 cm².",
          subject: "geometry",
          image_url: "/images/jk2025/q2.png"
        },
        {
          text: "Millie's mother wants a knife on the right-hand side and a fork on the left-hand side of each plate. Starting from the arrangement shown, what is the smallest number of knife–fork swaps needed?",
          options: ["1","2","3","5","6"],
          answer: "2",
          solution: "There are 4 items in the wrong place. Each swap fixes 2 items, so the minimum number of swaps is 4 ÷ 2 = 2.",
          subject: "logic",
          image_url: "/images/jk2025/q3.png"
        },
        {
          text: "On the left side of a room, Jia and Lottie are sleeping facing each other with heads on their pillows. On the right side, Anaya and Isla are sleeping back to back with heads on their pillows. How many of the four girls are sleeping with their right ear on their pillow?",
          options: ["0","1","2","3","4"],
          answer: "2",
          solution: "Jia and Lottie face each other, so exactly one has her right ear down. Anaya and Isla face away from each other, so exactly one has her right ear down. Total = 2.",
          subject: "logic",
          image_url: "/images/jk2025/q4.png"
        },
        {
          text: "The piece of paper shown is folded along the dotted lines to make an open box placed on a table with the top open. What letter is on the face that is on the table?",
          options: ["P","Q","R","S","T"],
          answer: "Q",
          solution: "When folded: P is opposite S, R is opposite T. Q has no face opposite it, so Q ends up on the table.",
          subject: "geometry",
          image_url: "/images/jk2025/q5.png"
        },
        {
          text: "Which of the following figures cannot be formed by gluing these two identical squares of paper together?",
          options: ["A (house/triangle top)","B (star shape)","C (rectangle)","D (L-shape)","E (arrow down)"],
          answer: "A (house/triangle top)",
          solution: "The triangle at the top of shape A would need to be equilateral, but the angle at the top is 90° (interior angle of a square), not 60°. So shape A cannot be formed. The others can be made by overlapping the two squares in various ways.",
          subject: "geometry",
          image_url: "/images/jk2025/q6.png"
        },
        {
          text: "2025 is a perfect square (45²). How many distinct prime numbers divide exactly into 2025?",
          options: ["1","2","3","4","5"],
          answer: "2",
          solution: "2025 = 45² = (3²×5)² = 3⁴ × 5². The only distinct primes are 3 and 5, so there are 2 distinct prime factors.",
          subject: "number"
        },
        {
          text: "Five squirrels V, W, X, Y, Z sit on a line. There are six nuts (marked ×) on the line between and around them. All squirrels run toward their nearest nut simultaneously at the same speed; when a squirrel gets a nut it heads to the next nearest. Which squirrel gets two nuts?",
          options: ["V","W","X","Y","Z"],
          answer: "X",
          solution: "After the first nuts are collected, the remaining nut is between X, Y and Z but squirrel X is closest to it, so X collects two nuts.",
          subject: "logic",
          image_url: "/images/jk2025/q8.png"
        },
        {
          text: "There are 30 students in a class. They sit in pairs so that each boy is sitting next to a girl, and exactly half the girls are sitting next to a boy. How many boys are there?",
          options: ["25","20","15","10","5"],
          answer: "10",
          solution: "Let there be x boys. Each boy sits next to a girl, so x girls sit next to a boy. Since half the girls sit next to a boy, there are 2x girls in total. x + 2x = 30 gives x = 10.",
          subject: "algebra"
        },
        {
          text: "The number 2581953764 is written on a strip of paper. Dilraj cuts the strip twice to get three numbers, then adds them. What is the smallest possible sum?",
          options: ["2675","2975","2978","4217","4298"],
          answer: "2975",
          solution: "Splitting as 258 | 1953 | 764 gives sum 2975. Splitting as 2581 | 953 | 764 gives 4298, and 258 | 195 | 3764 gives 4217. The minimum is 2975.",
          subject: "number"
        },
        {
          text: "My granny bought enough cat food to last her 4 cats for 12 days. On the way home she found 2 stray cats and kept them. Each cat gets the same amount daily. How many days does the food last?",
          options: ["8","7","6","5","4"],
          answer: "8",
          solution: "Total food = 4 × 12 = 48 cat-days. Shared among 6 cats: 48 ÷ 6 = 8 days.",
          subject: "number"
        },
        {
          text: "Each letter in 'BENJAMIN' represents a different digit from 1 to 7. The integer BENJAMIN is odd and divisible by 3. Which digit does N represent?",
          options: ["1","3","4","5","7"],
          answer: "5",
          solution: "N appears twice; all others appear once. Digit sum = (1+2+3+4+5+6+7) + N = 28 + N. For divisibility by 3, 28+N must be divisible by 3, so N ≡ 2 (mod 3). Among odd digits 1–7: N=5 gives 33 ÷ 3 = 11 ✓. So N = 5.",
          subject: "number"
        },
        {
          text: "Tim, Tom and Jim are triplets. Their brother Carl is 3 years younger. Which of the following could be the sum of the ages of the four brothers?",
          options: ["53","54","56","59","63"],
          answer: "53",
          solution: "If the triplets are each age x, Carl is x−3. Sum = 4x−3. This must be 3 less than a multiple of 4. Only 53 = 4×14−3 satisfies this. (Tim, Tom, Jim = 14; Carl = 11.)",
          subject: "algebra"
        },
        {
          text: "The perimeter of rectangle PQRS is 30 cm. Three smaller rectangles are added with their centres at P, Q and S, and the sum of their perimeters is 20 cm. What is the total perimeter of the new shape?",
          options: ["50 cm","45 cm","40 cm","35 cm","33 cm"],
          answer: "40 cm",
          solution: "Each added rectangle increases the total perimeter by half its own perimeter. The three rectangles add ½ × 20 = 10 cm. Total perimeter = 30 + 10 = 40 cm.",
          subject: "geometry",
          image_url: "/images/jk2025/q14.png"
        },
        {
          text: "Run Ze writes all integers where: the first digit is 1, each following digit is at least as large as the one before it, and the digit sum is 5. How many such integers does he write?",
          options: ["9","8","7","6","5"],
          answer: "5",
          solution: "The integers are: 11111, 1112, 113, 14, and 122. That is 5 integers.",
          subject: "logic"
        },
        {
          text: "What is the largest number of shapes of this form (an L-tetromino made of 4 squares) that can be cut out from a 5×5 square?",
          options: ["2","4","5","6","7"],
          answer: "6",
          solution: "Each piece covers 4 squares. Since 25 = 4×6+1, at most 6 pieces could fit, and it is possible to arrange 6 non-overlapping L-tetrominoes in the 5×5 grid.",
          subject: "logic",
          image_url: "/images/jk2025/q16.png"
        },
        {
          text: "Luigi has some square tables and chairs. Arranging tables singly with 4 chairs each leaves him 6 chairs short. Arranging tables in pairs with 6 chairs per pair leaves 4 chairs over. How many tables did he receive?",
          options: ["8","10","12","14","16"],
          answer: "10",
          solution: "Let the number of tables be 2x. Chairs available = 8x − 6 = 6x + 4, so 2x = 10. Luigi received 10 tables.",
          subject: "algebra"
        },
        {
          text: "Lily wants to make a large triangle from small triangular tiles. She has already put some tiles together as shown. What is the smallest number of small tiles she now needs to complete a large triangle?",
          options: ["5","9","12","15","18"],
          answer: "9",
          solution: "The existing shape fits inside a large triangle whose rows contain 7+5+3+1 = 16 tiles. Since 7 tiles are placed, she needs 16 − 7 = 9 more tiles.",
          subject: "geometry",
          image_url: "/images/jk2025/q18.png"
        },
        {
          text: "Three vertices of rectangle PQRS are at P(1,1), Q(7,4) and R(5,8). What are the co-ordinates of S?",
          options: ["(-1,4)","(0,5)","(-2,6)","(-1,5)","(-1,6)"],
          answer: "(-1,5)",
          solution: "PQ vector: (6,3). SR must equal PQ. S = R − PQ = (5−6, 8−3) = (−1,5).",
          subject: "geometry"
        },
        {
          text: "A large cube was built from eight equally-sized small cubes, some painted black and some painted white. Five of the faces of the large cube are shown in the diagram. What does the sixth face of the large cube look like?",
          options: ["All white (0 black squares)","1 black square top-left","1 black square bottom-right","2 black squares diagonal","2 black squares same side"],
          answer: "All white (0 black squares)",
          solution: "Each small cube has 3 faces on the large cube. Total visible black squares must be a multiple of 3. Five faces show 2+1+1+1+1 = 6 black squares. The sixth face must add 0 black squares (6+0=6, a multiple of 3). So the sixth face is all white.",
          subject: "logic",
          image_url: "/images/jk2025/q20.png"
        },
        {
          text: "A rectangular swimming pool of length 20 m is surrounded on all four sides by a path 2 m wide. The area of the path equals the area of the pool. What is the width, in metres, of the pool?",
          options: ["6.5","6","5.5","5","4.5"],
          answer: "6",
          solution: "Let width = Y m. Outer rectangle: 24×(Y+4). Path area = 24(Y+4) − 20Y = 20Y. So 96 = 16Y, giving Y = 6.",
          subject: "algebra"
        },
        {
          text: "Kirsten wrote numbers in five of ten circles arranged around a pentagon, as shown. She wants to write a number in each of the remaining five circles so that the sums of the three numbers along each side of the pentagon are equal. Which number should she write in the circle marked X?",
          options: ["7","8","11","13","15"],
          answer: "13",
          solution: "Setting up equations from equal side sums: q = 9 and X + 2 = q + 6 = 15, so X = 13.",
          subject: "algebra",
          image_url: "/images/jk2025/q22.png"
        },
        {
          text: "Joey starts with 12 and makes 60 calculations, each time multiplying or dividing by 2 or by 3. Which of the following could NOT be his final answer?",
          options: ["12","18","36","72","108"],
          answer: "36",
          solution: "After 60 calculations the result must be reachable with an even number of net changes. 36 = 12×3 requires an odd number of net operations and cannot be achieved after an even total of 60 steps.",
          subject: "number"
        },
        {
          text: "The digits of three-digit integer 'XYZ' are all different. The digit sum of 'XXY' equals the two-digit integer 'YZ'. The digit sum of 'YZ' equals the digit 'Y'. What digit does X represent?",
          options: ["4","5","6","8","9"],
          answer: "9",
          solution: "Y+Z = Y implies Z = 0. Then 2X+Y = 10Y, so 2X = 9Y, meaning X = 9 and Y = 2.",
          subject: "number"
        },
        {
          text: "Two three-digit integers have all six digits distinct. The first digit of the second integer is twice the last digit of the first integer. What is the smallest possible sum of the two integers?",
          options: ["597","546","537","535","301"],
          answer: "537",
          solution: "To minimise the sum, use 1 and 4 in the hundreds places (since 4 = 2×2 and the last digit of the first integer is 2). One example: 102 + 435 = 537.",
          subject: "number"
        }
      ];

      for (const q of kangarooQuestions) {
        await pool.query(
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source, subject, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          ['kangaroo', 'multipleChoice', q.text, q.answer, JSON.stringify(q.options), q.solution, 'Junior Kangaroo 2025', q.subject, q.image_url || null]
        );
      }
      console.log('Seeded 25 Junior Kangaroo 2025 questions');
    }

    // Seed an additional Kangaroo practice bank of 100 questions (idempotent)
    const kangarooExtraCheck = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE source = 'Kangaroo Practice Bank'"
    );
    if (parseInt(kangarooExtraCheck.rows[0].count) === 0) {
      const kangarooExtraQuestions = [
        {
          text: "What is 10% of 90?",
          options: ["18","0","81","19","9"],
          answer: "9",
          solution: "10% of 90 = (10/100) × 90 = 9.",
          subject: "number"
        },
        {
          text: "What is 20% of 65?",
          options: ["52","19","13","7","26"],
          answer: "13",
          solution: "20% of 65 = (20/100) × 65 = 13.",
          subject: "number"
        },
        {
          text: "What is 25% of 84?",
          options: ["29","13","42","21","63"],
          answer: "21",
          solution: "25% of 84 = (25/100) × 84 = 21.",
          subject: "number"
        },
        {
          text: "What is 30% of 120?",
          options: ["48","24","72","84","36"],
          answer: "36",
          solution: "30% of 120 = (30/100) × 120 = 36.",
          subject: "number"
        },
        {
          text: "What is 40% of 55?",
          options: ["33","44","27","22","17"],
          answer: "22",
          solution: "40% of 55 = (40/100) × 55 = 22.",
          subject: "number"
        },
        {
          text: "What is 5% of 220?",
          options: ["33","0","11","209","22"],
          answer: "11",
          solution: "5% of 220 = (5/100) × 220 = 11.",
          subject: "number"
        },
        {
          text: "What is 15% of 180?",
          options: ["9","45","27","153","54"],
          answer: "27",
          solution: "15% of 180 = (15/100) × 180 = 27.",
          subject: "number"
        },
        {
          text: "What is 60% of 45?",
          options: ["31","27","18","23","54"],
          answer: "27",
          solution: "60% of 45 = (60/100) × 45 = 27.",
          subject: "number"
        },
        {
          text: "What is 75% of 96?",
          options: ["63","144","72","81","24"],
          answer: "72",
          solution: "75% of 96 = (75/100) × 96 = 72.",
          subject: "number"
        },
        {
          text: "What is 35% of 60?",
          options: ["15","27","42","21","39"],
          answer: "21",
          solution: "35% of 60 = (35/100) × 60 = 21.",
          subject: "number"
        },
        {
          text: "What is 12% of 150?",
          options: ["132","33","18","3","36"],
          answer: "18",
          solution: "12% of 150 = (12/100) × 150 = 18.",
          subject: "number"
        },
        {
          text: "What is 80% of 25?",
          options: ["18","5","40","20","22"],
          answer: "20",
          solution: "80% of 25 = (80/100) × 25 = 20.",
          subject: "number"
        },
        {
          text: "What is 45% of 40?",
          options: ["18","36","22","63","14"],
          answer: "18",
          solution: "45% of 40 = (45/100) × 40 = 18.",
          subject: "number"
        },
        {
          text: "What is 90% of 30?",
          options: ["3","27","54","24","30"],
          answer: "27",
          solution: "90% of 30 = (90/100) × 30 = 27.",
          subject: "number"
        },
        {
          text: "What is 24% of 50?",
          options: ["17","7","38","24","12"],
          answer: "12",
          solution: "24% of 50 = (24/100) × 50 = 12.",
          subject: "number"
        },
        {
          text: "Find the next number in the sequence: 2, 5, 8, 11, ?",
          options: ["13","17","15","14","16"],
          answer: "14",
          solution: "The rule is: add 3 each time. So the next number is 14.",
          subject: "number"
        },
        {
          text: "Find the next number in the sequence: 3, 6, 12, 24, ?",
          options: ["47","49","48","50","51"],
          answer: "48",
          solution: "The rule is: double each time. So the next number is 48.",
          subject: "number"
        },
        {
          text: "Find the next number in the sequence: 1, 4, 9, 16, ?",
          options: ["25","27","28","24","26"],
          answer: "25",
          solution: "The rule is: square numbers: 1², 2², 3², 4², 5². So the next number is 25.",
          subject: "number"
        },
        {
          text: "Find the next number in the sequence: 1, 1, 2, 3, 5, ?",
          options: ["11","7","10","9","8"],
          answer: "8",
          solution: "The rule is: Fibonacci: each term is the sum of the previous two. So the next number is 8.",
          subject: "number"
        },
        {
          text: "Find the next number in the sequence: 100, 90, 80, 70, ?",
          options: ["60","61","63","62","59"],
          answer: "60",
          solution: "The rule is: subtract 10 each time. So the next number is 60.",
          subject: "number"
        },
        {
          text: "Find the next number in the sequence: 2, 4, 8, 16, ?",
          options: ["32","35","34","33","31"],
          answer: "32",
          solution: "The rule is: double each time. So the next number is 32.",
          subject: "number"
        },
        {
          text: "Find the next number in the sequence: 1, 3, 6, 10, ?",
          options: ["17","18","14","16","15"],
          answer: "15",
          solution: "The rule is: triangular numbers: add one more each time (+2,+3,+4,+5). So the next number is 15.",
          subject: "number"
        },
        {
          text: "Find the next number in the sequence: 5, 10, 20, 40, ?",
          options: ["81","79","80","82","83"],
          answer: "80",
          solution: "The rule is: double each time. So the next number is 80.",
          subject: "number"
        },
        {
          text: "Find the next number in the sequence: 1, 8, 27, 64, ?",
          options: ["126","128","125","124","127"],
          answer: "125",
          solution: "The rule is: cube numbers: 1³, 2³, 3³, 4³, 5³. So the next number is 125.",
          subject: "number"
        },
        {
          text: "Find the next number in the sequence: 50, 44, 38, 32, ?",
          options: ["27","25","26","29","28"],
          answer: "26",
          solution: "The rule is: subtract 6 each time. So the next number is 26.",
          subject: "number"
        },
        {
          text: "A rectangle has length 7 cm and width 4 cm. What is its area?",
          options: ["28 cm²","21 cm²","11 cm²","22 cm²","32 cm²"],
          answer: "28 cm²",
          solution: "Area = length × width = 7 × 4 = 28 cm².",
          subject: "geometry"
        },
        {
          text: "A rectangle has length 9 cm and width 5 cm. What is its area?",
          options: ["45 cm²","50 cm²","28 cm²","36 cm²","14 cm²"],
          answer: "45 cm²",
          solution: "Area = length × width = 9 × 5 = 45 cm².",
          subject: "geometry"
        },
        {
          text: "A rectangle has length 12 cm and width 3 cm. What is its area?",
          options: ["39 cm²","30 cm²","36 cm²","24 cm²","15 cm²"],
          answer: "36 cm²",
          solution: "Area = length × width = 12 × 3 = 36 cm².",
          subject: "geometry"
        },
        {
          text: "A rectangle has length 8 cm and width 6 cm. What is its area?",
          options: ["40 cm²","28 cm²","54 cm²","14 cm²","48 cm²"],
          answer: "48 cm²",
          solution: "Area = length × width = 8 × 6 = 48 cm².",
          subject: "geometry"
        },
        {
          text: "A rectangle has length 11 cm and width 4 cm. What is its area?",
          options: ["15 cm²","44 cm²","33 cm²","30 cm²","48 cm²"],
          answer: "44 cm²",
          solution: "Area = length × width = 11 × 4 = 44 cm².",
          subject: "geometry"
        },
        {
          text: "A rectangle has length 15 cm and width 2 cm. What is its area?",
          options: ["30 cm²","32 cm²","17 cm²","15 cm²","34 cm²"],
          answer: "30 cm²",
          solution: "Area = length × width = 15 × 2 = 30 cm².",
          subject: "geometry"
        },
        {
          text: "A rectangle has length 10 cm and width 3 cm. What is its perimeter?",
          options: ["28 cm","26 cm","30 cm","13 cm","22 cm"],
          answer: "26 cm",
          solution: "Perimeter = 2 × (length + width) = 2 × (10 + 3) = 26 cm.",
          subject: "geometry"
        },
        {
          text: "A rectangle has length 14 cm and width 6 cm. What is its perimeter?",
          options: ["36 cm","42 cm","20 cm","84 cm","40 cm"],
          answer: "40 cm",
          solution: "Perimeter = 2 × (length + width) = 2 × (14 + 6) = 40 cm.",
          subject: "geometry"
        },
        {
          text: "A rectangle has length 9 cm and width 9 cm. What is its perimeter?",
          options: ["18 cm","38 cm","32 cm","81 cm","36 cm"],
          answer: "36 cm",
          solution: "Perimeter = 2 × (length + width) = 2 × (9 + 9) = 36 cm.",
          subject: "geometry"
        },
        {
          text: "A rectangle has length 20 cm and width 5 cm. What is its perimeter?",
          options: ["52 cm","46 cm","25 cm","50 cm","100 cm"],
          answer: "50 cm",
          solution: "Perimeter = 2 × (length + width) = 2 × (20 + 5) = 50 cm.",
          subject: "geometry"
        },
        {
          text: "Two angles of a triangle are 50° and 60°. What is the third angle?",
          options: ["60°","70°","50°","80°","90°"],
          answer: "70°",
          solution: "Angles in a triangle sum to 180°. Third angle = 180° − 50° − 60° = 70°.",
          subject: "geometry"
        },
        {
          text: "Two angles of a triangle are 35° and 95°. What is the third angle?",
          options: ["95°","60°","50°","40°","35°"],
          answer: "50°",
          solution: "Angles in a triangle sum to 180°. Third angle = 180° − 35° − 95° = 50°.",
          subject: "geometry"
        },
        {
          text: "Two angles of a triangle are 72° and 48°. What is the third angle?",
          options: ["50°","70°","48°","60°","72°"],
          answer: "60°",
          solution: "Angles in a triangle sum to 180°. Third angle = 180° − 72° − 48° = 60°.",
          subject: "geometry"
        },
        {
          text: "Two angles of a triangle are 100° and 45°. What is the third angle?",
          options: ["100°","25°","55°","35°","45°"],
          answer: "35°",
          solution: "Angles in a triangle sum to 180°. Third angle = 180° − 100° − 45° = 35°.",
          subject: "geometry"
        },
        {
          text: "Two angles of a triangle are 63° and 63°. What is the third angle?",
          options: ["63°","74°","54°","64°","44°"],
          answer: "54°",
          solution: "Angles in a triangle sum to 180°. Third angle = 180° − 63° − 63° = 54°.",
          subject: "geometry"
        },
        {
          text: "A right-angled triangle has legs of length 3 cm and 4 cm. What is the length of the hypotenuse?",
          options: ["12 cm","3 cm","7 cm","5 cm","10 cm"],
          answer: "5 cm",
          solution: "By Pythagoras' theorem: hypotenuse² = 3² + 4² = 9 + 16 = 25. Hypotenuse = √25 = 5 cm.",
          subject: "geometry"
        },
        {
          text: "A right-angled triangle has legs of length 6 cm and 8 cm. What is the length of the hypotenuse?",
          options: ["48 cm","12 cm","14 cm","8 cm","10 cm"],
          answer: "10 cm",
          solution: "By Pythagoras' theorem: hypotenuse² = 6² + 8² = 36 + 64 = 100. Hypotenuse = √100 = 10 cm.",
          subject: "geometry"
        },
        {
          text: "A right-angled triangle has legs of length 5 cm and 12 cm. What is the length of the hypotenuse?",
          options: ["13 cm","11 cm","60 cm","17 cm","15 cm"],
          answer: "13 cm",
          solution: "By Pythagoras' theorem: hypotenuse² = 5² + 12² = 25 + 144 = 169. Hypotenuse = √169 = 13 cm.",
          subject: "geometry"
        },
        {
          text: "A right-angled triangle has legs of length 9 cm and 12 cm. What is the length of the hypotenuse?",
          options: ["15 cm","108 cm","13 cm","21 cm","17 cm"],
          answer: "15 cm",
          solution: "By Pythagoras' theorem: hypotenuse² = 9² + 12² = 81 + 144 = 225. Hypotenuse = √225 = 15 cm.",
          subject: "geometry"
        },
        {
          text: "A right-angled triangle has legs of length 8 cm and 15 cm. What is the length of the hypotenuse?",
          options: ["17 cm","23 cm","120 cm","19 cm","15 cm"],
          answer: "17 cm",
          solution: "By Pythagoras' theorem: hypotenuse² = 8² + 15² = 64 + 225 = 289. Hypotenuse = √289 = 17 cm.",
          subject: "geometry"
        },
        {
          text: "A square has side length 4 cm. What is its area?",
          options: ["23 cm²","12 cm²","25 cm²","20 cm²","16 cm²"],
          answer: "16 cm²",
          solution: "Area of a square = side × side = 4 × 4 = 16 cm².",
          subject: "geometry"
        },
        {
          text: "A square has side length 6 cm. What is its area?",
          options: ["24 cm²","18 cm²","30 cm²","36 cm²","42 cm²"],
          answer: "36 cm²",
          solution: "Area of a square = side × side = 6 × 6 = 36 cm².",
          subject: "geometry"
        },
        {
          text: "A square has side length 7 cm. What is its area?",
          options: ["28 cm²","42 cm²","49 cm²","56 cm²","21 cm²"],
          answer: "49 cm²",
          solution: "Area of a square = side × side = 7 × 7 = 49 cm².",
          subject: "geometry"
        },
        {
          text: "A square has side length 9 cm. What is its area?",
          options: ["27 cm²","90 cm²","36 cm²","72 cm²","81 cm²"],
          answer: "81 cm²",
          solution: "Area of a square = side × side = 9 × 9 = 81 cm².",
          subject: "geometry"
        },
        {
          text: "A square has side length 12 cm. What is its area?",
          options: ["48 cm²","156 cm²","36 cm²","144 cm²","132 cm²"],
          answer: "144 cm²",
          solution: "Area of a square = side × side = 12 × 12 = 144 cm².",
          subject: "geometry"
        },
        {
          text: "How many factors does 24 have?",
          options: ["9","7","8","6","10"],
          answer: "8",
          solution: "Listing all whole numbers that divide 24 exactly shows there are 8 factors.",
          subject: "number"
        },
        {
          text: "How many factors does 36 have?",
          options: ["10","8","9","11","7"],
          answer: "9",
          solution: "Listing all whole numbers that divide 36 exactly shows there are 9 factors.",
          subject: "number"
        },
        {
          text: "How many factors does 60 have?",
          options: ["14","11","12","10","13"],
          answer: "12",
          solution: "Listing all whole numbers that divide 60 exactly shows there are 12 factors.",
          subject: "number"
        },
        {
          text: "How many factors does 100 have?",
          options: ["9","7","8","10","11"],
          answer: "9",
          solution: "Listing all whole numbers that divide 100 exactly shows there are 9 factors.",
          subject: "number"
        },
        {
          text: "How many factors does 45 have?",
          options: ["8","7","4","6","5"],
          answer: "6",
          solution: "Listing all whole numbers that divide 45 exactly shows there are 6 factors.",
          subject: "number"
        },
        {
          text: "What is the highest common factor (HCF) of 24 and 36?",
          options: ["17","24","11","13","12"],
          answer: "12",
          solution: "The largest whole number dividing both 24 and 36 exactly is 12.",
          subject: "number"
        },
        {
          text: "What is the highest common factor (HCF) of 18 and 48?",
          options: ["7","5","11","12","6"],
          answer: "6",
          solution: "The largest whole number dividing both 18 and 48 exactly is 6.",
          subject: "number"
        },
        {
          text: "What is the highest common factor (HCF) of 45 and 60?",
          options: ["30","16","15","14","20"],
          answer: "15",
          solution: "The largest whole number dividing both 45 and 60 exactly is 15.",
          subject: "number"
        },
        {
          text: "What is the highest common factor (HCF) of 28 and 42?",
          options: ["15","14","19","13","28"],
          answer: "14",
          solution: "The largest whole number dividing both 28 and 42 exactly is 14.",
          subject: "number"
        },
        {
          text: "What is the highest common factor (HCF) of 16 and 40?",
          options: ["16","13","9","7","8"],
          answer: "8",
          solution: "The largest whole number dividing both 16 and 40 exactly is 8.",
          subject: "number"
        },
        {
          text: "What is the lowest common multiple (LCM) of 4 and 6?",
          options: ["24","16","6","25","12"],
          answer: "12",
          solution: "The smallest number that both 4 and 6 divide into exactly is 12.",
          subject: "number"
        },
        {
          text: "What is the lowest common multiple (LCM) of 6 and 8?",
          options: ["24","16","8","30","48"],
          answer: "24",
          solution: "The smallest number that both 6 and 8 divide into exactly is 24.",
          subject: "number"
        },
        {
          text: "What is the lowest common multiple (LCM) of 9 and 12?",
          options: ["45","12","36","108","24"],
          answer: "36",
          solution: "The smallest number that both 9 and 12 divide into exactly is 36.",
          subject: "number"
        },
        {
          text: "What is the lowest common multiple (LCM) of 5 and 15?",
          options: ["31","20","75","15","30"],
          answer: "15",
          solution: "The smallest number that both 5 and 15 divide into exactly is 15.",
          subject: "number"
        },
        {
          text: "What is the lowest common multiple (LCM) of 8 and 10?",
          options: ["40","30","80","48","10"],
          answer: "40",
          solution: "The smallest number that both 8 and 10 divide into exactly is 40.",
          subject: "number"
        },
        {
          text: "A car travels at 60 km/h for 2 hours. How far does it travel?",
          options: ["62 km","120 km","60 km","155 km","180 km"],
          answer: "120 km",
          solution: "Distance = speed × time = 60 × 2 = 120 km.",
          subject: "number"
        },
        {
          text: "A car travels at 40 km/h for 3 hours. How far does it travel?",
          options: ["43 km","160 km","80 km","155 km","120 km"],
          answer: "120 km",
          solution: "Distance = speed × time = 40 × 3 = 120 km.",
          subject: "number"
        },
        {
          text: "A car travels at 80 km/h for 1.5 hours. How far does it travel?",
          options: ["40 km","200 km","81 km","160 km","120 km"],
          answer: "120 km",
          solution: "Distance = speed × time = 80 × 1.5 = 120 km.",
          subject: "number"
        },
        {
          text: "A car travels at 50 km/h for 4 hours. How far does it travel?",
          options: ["100 km","150 km","200 km","250 km","54 km"],
          answer: "200 km",
          solution: "Distance = speed × time = 50 × 4 = 200 km.",
          subject: "number"
        },
        {
          text: "A car travels at 30 km/h for 5 hours. How far does it travel?",
          options: ["60 km","180 km","35 km","150 km","120 km"],
          answer: "150 km",
          solution: "Distance = speed × time = 30 × 5 = 150 km.",
          subject: "number"
        },
        {
          text: "A car travels at 90 km/h for 2 hours. How far does it travel?",
          options: ["215 km","92 km","180 km","270 km","90 km"],
          answer: "180 km",
          solution: "Distance = speed × time = 90 × 2 = 180 km.",
          subject: "number"
        },
        {
          text: "A car travels at 45 km/h for 4 hours. How far does it travel?",
          options: ["49 km","225 km","90 km","180 km","135 km"],
          answer: "180 km",
          solution: "Distance = speed × time = 45 × 4 = 180 km.",
          subject: "number"
        },
        {
          text: "4 identical pens cost £20 in total. How much do 7 pens cost?",
          options: ["£30","£35","£40","£42","£20"],
          answer: "£35",
          solution: "Each pen costs £20 ÷ 4 = £5. So 7 pens cost 7 × £5 = £35.",
          subject: "number"
        },
        {
          text: "3 identical pens cost £15 in total. How much do 5 pens cost?",
          options: ["£25","£36","£15","£20","£30"],
          answer: "£25",
          solution: "Each pen costs £15 ÷ 3 = £5. So 5 pens cost 5 × £5 = £25.",
          subject: "number"
        },
        {
          text: "6 identical pens cost £24 in total. How much do 10 pens cost?",
          options: ["£40","£44","£36","£50","£24"],
          answer: "£40",
          solution: "Each pen costs £24 ÷ 6 = £4. So 10 pens cost 10 × £4 = £40.",
          subject: "number"
        },
        {
          text: "5 identical pens cost £35 in total. How much do 8 pens cost?",
          options: ["£49","£35","£64","£63","£56"],
          answer: "£56",
          solution: "Each pen costs £35 ÷ 5 = £7. So 8 pens cost 8 × £7 = £56.",
          subject: "number"
        },
        {
          text: "2 identical pens cost £10 in total. How much do 6 pens cost?",
          options: ["£36","£35","£10","£25","£30"],
          answer: "£30",
          solution: "Each pen costs £10 ÷ 2 = £5. So 6 pens cost 6 × £5 = £30.",
          subject: "number"
        },
        {
          text: "8 identical pens cost £32 in total. How much do 3 pens cost?",
          options: ["£15","£32","£12","£8","£16"],
          answer: "£12",
          solution: "Each pen costs £32 ÷ 8 = £4. So 3 pens cost 3 × £4 = £12.",
          subject: "number"
        },
        {
          text: "10 identical pens cost £20 in total. How much do 4 pens cost?",
          options: ["£12","£10","£8","£6","£20"],
          answer: "£8",
          solution: "Each pen costs £20 ÷ 10 = £2. So 4 pens cost 4 × £2 = £8.",
          subject: "number"
        },
        {
          text: "Maya is 8 years old now. How old will she be in 5 years?",
          options: ["8","13","5","3","15"],
          answer: "13",
          solution: "8 + 5 = 13.",
          subject: "algebra"
        },
        {
          text: "Maya is 12 years old now. How old will she be in 7 years?",
          options: ["5","19","21","12","7"],
          answer: "19",
          solution: "12 + 7 = 19.",
          subject: "algebra"
        },
        {
          text: "Maya is 15 years old now. How old will she be in 10 years?",
          options: ["15","5","25","27","10"],
          answer: "25",
          solution: "15 + 10 = 25.",
          subject: "algebra"
        },
        {
          text: "Maya is 6 years old now. How old will she be in 9 years?",
          options: ["15","17","9","8","6"],
          answer: "15",
          solution: "6 + 9 = 15.",
          subject: "algebra"
        },
        {
          text: "Maya is 20 years old now. How old will she be in 4 years?",
          options: ["24","4","26","16","20"],
          answer: "24",
          solution: "20 + 4 = 24.",
          subject: "algebra"
        },
        {
          text: "Maya is 9 years old now. How old will she be in 11 years?",
          options: ["20","26","22","11","9"],
          answer: "20",
          solution: "9 + 11 = 20.",
          subject: "algebra"
        },
        {
          text: "In how many different ways can 3 different books be arranged in a row on a shelf?",
          options: ["15","9","12","6","3"],
          answer: "6",
          solution: "3 different books can be arranged in 3! = 3 × 2 × 1 = 6 ways.",
          subject: "logic"
        },
        {
          text: "In how many different ways can 4 different books be arranged in a row on a shelf?",
          options: ["28","48","20","24","16"],
          answer: "24",
          solution: "4 different books can be arranged in 4! = 4 × 3 × 2 × 1 = 24 ways.",
          subject: "logic"
        },
        {
          text: "In how many different ways can 5 different books be arranged in a row on a shelf?",
          options: ["115","125","120","25","240"],
          answer: "120",
          solution: "5 different books can be arranged in 5! = 5 × 4 × 3 × 2 × 1 = 120 ways.",
          subject: "logic"
        },
        {
          text: "In how many different ways can 6 different books be arranged in a row on a shelf?",
          options: ["1440","720","714","36","726"],
          answer: "720",
          solution: "6 different books can be arranged in 6! = 6 × 5 × 4 × 3 × 2 × 1 = 720 ways.",
          subject: "logic"
        },
        {
          text: "In how many different ways can 7 different books be arranged in a row on a shelf?",
          options: ["10080","5047","5033","49","5040"],
          answer: "5040",
          solution: "7 different books can be arranged in 7! = 7 × 6 × 5 × 4 × 3 × 2 × 1 = 5040 ways.",
          subject: "logic"
        },
        {
          text: "In how many ways can you choose 2 people from a group of 5 people?",
          options: ["11","12","9","10","15"],
          answer: "10",
          solution: "Number of ways = 5C2 = 5!/(2!×3!) = 10.",
          subject: "logic"
        },
        {
          text: "In how many ways can you choose 2 people from a group of 6 people?",
          options: ["17","14","15","16","12"],
          answer: "15",
          solution: "Number of ways = 6C2 = 6!/(2!×4!) = 15.",
          subject: "logic"
        },
        {
          text: "In how many ways can you choose 2 people from a group of 4 people?",
          options: ["11","7","8","6","5"],
          answer: "6",
          solution: "Number of ways = 4C2 = 4!/(2!×2!) = 6.",
          subject: "logic"
        },
        {
          text: "In how many ways can you choose 2 people from a group of 7 people?",
          options: ["22","23","14","21","20"],
          answer: "21",
          solution: "Number of ways = 7C2 = 7!/(2!×5!) = 21.",
          subject: "logic"
        },
        {
          text: "In how many ways can you choose 3 people from a group of 5 people?",
          options: ["13","11","10","9","15"],
          answer: "10",
          solution: "Number of ways = 5C3 = 5!/(3!×2!) = 10.",
          subject: "logic"
        },
        {
          text: "What is the probability of rolling an even number on a fair six-sided die?",
          options: ["2/5","1/2","5/6","3/4","1/3"],
          answer: "1/2",
          solution: "3 of the 6 faces (2, 4, 6) are even, so the probability is 3/6 = 1/2.",
          subject: "logic"
        },
        {
          text: "What is the probability of rolling a number greater than 4 on a fair six-sided die?",
          options: ["2/5","1/2","1/3","1/4","1/5"],
          answer: "1/3",
          solution: "2 of the 6 faces (5, 6) are greater than 4, so the probability is 2/6 = 1/3.",
          subject: "logic"
        },
        {
          text: "A fair coin is flipped twice. What is the probability of getting two heads?",
          options: ["1/2","2/3","1/4","3/5","2/5"],
          answer: "1/4",
          solution: "There are 4 equally likely outcomes (HH, HT, TH, TT), and only 1 gives two heads, so the probability is 1/4.",
          subject: "logic"
        },
        {
          text: "What is the probability of rolling a multiple of 3 on a fair six-sided die?",
          options: ["2/5","1/3","5/6","3/4","2/3"],
          answer: "1/3",
          solution: "2 of the 6 faces (3, 6) are multiples of 3, so the probability is 2/6 = 1/3.",
          subject: "logic"
        },
        {
          text: "A bag contains 3 red and 2 blue balls. One ball is drawn at random. What is the probability that it is red?",
          options: ["2/5","2/3","3/5","1/3","1/2"],
          answer: "3/5",
          solution: "There are 3 red balls out of 5 total, so the probability is 3/5.",
          subject: "logic"
        }
      ];

      for (const q of kangarooExtraQuestions) {
        await pool.query(
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source, subject)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          ['kangaroo', 'multipleChoice', q.text, q.answer, JSON.stringify(q.options), q.solution, 'Kangaroo Practice Bank', q.subject]
        );
      }
      console.log('Seeded 100 Kangaroo Practice Bank questions');
    }

    // Seed verified questions from real Kangaroo competition papers (idempotent),
    // tagged with a difficulty tier (easy/medium/hard) matching the papers'
    // own 3/4/5-point structure.
    const kangarooPdfCheck = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE source IN ('Kangaroo 2022 Austria', 'Kangaroo 2021 Brazil')"
    );
    if (parseInt(kangarooPdfCheck.rows[0].count) === 0) {
      const kangarooPdfQuestions = [
        {
          text: "What is (20+22) ÷ (20−22)?",
          options: ["-42","-21","-2","22","42"],
          answer: "-21",
          solution: "20+22 = 42 and 20−22 = −2. So the answer is 42 ÷ (−2) = −21.",
          subject: "number",
          level: "easy",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "Beate arranges five cards showing 4, 8, 31, 59 and 107 next to each other so that the smallest possible nine-digit number is created. Which card ends up furthest on the right?",
          options: ["4","8","31","59","107"],
          answer: "8",
          solution: "To make the smallest number, place cards with the smallest leading digit first: 107, then 31, then 4, then 59, then 8, giving 107314598. The card furthest right is 8.",
          subject: "logic",
          level: "easy",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "The numbers 3, 4, 5, 6, 7 are written inside five circles of a shape (one number per circle). The product of the numbers in the four outer circles is 360. Which number is in the inner circle?",
          options: ["3","4","5","6","7"],
          answer: "7",
          solution: "The product of all five numbers is 3×4×5×6×7 = 2520. The inner number is 2520 ÷ 360 = 7.",
          subject: "number",
          level: "easy",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "Anna, Beatrice and Clara altogether are 15 years old. Anna and Beatrice together are 11 years old. Beatrice and Clara together are 12 years old. How old is the oldest of the three?",
          options: ["4","5","6","7","8"],
          answer: "8",
          solution: "Clara = 15−11 = 4. Beatrice = 12−4 = 8. Anna = 11−8 = 3. The oldest is Beatrice, aged 8.",
          subject: "algebra",
          level: "easy",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "Kengu jumps along a number line. He starts at 0, then always does two big jumps of 3 followed by three small jumps of 1, over and over again (so he lands on 3, 6, 7, 8, 9, 12, 15, 16, 17, 18, ...). On which of the following numbers will he land?",
          options: ["82","83","84","85","86"],
          answer: "84",
          solution: "Each full cycle of 5 jumps covers 9 units and lands on positions 9k+3, 9k+6, 9k+7, 9k+8 or 9k (relative to the start of the cycle). Checking 82-86 mod 9: only 84 = 9×9+3 matches a landing position.",
          subject: "number",
          level: "easy",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "Otto attaches his number plate upside down, but luckily it looks exactly the same either way. Which of the following number plates could be Otto's?",
          options: ["04 NSN 40","60 SOS 09","80 BNB 08","06 HNH 60","08 NBN 80"],
          answer: "60 SOS 09",
          solution: "A plate looks the same upside down if reversing it and rotating each character 180° gives back the same plate. Digits 6 and 9 swap, and 0, S and O are unchanged by rotation. Checking \"60 SOS 09\": reversed and rotated gives \"60 SOS 09\" again. The other options contain characters (4 or B) that have no valid 180° rotation.",
          subject: "logic",
          level: "easy",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "There are five gaps in the calculation 6 _ 9 _ 12 _ 15 _ 18 _ 21 = 45. Adriana wants to write a \"+\" into four of the gaps and a \"−\" into one of the gaps so the equation is correct. Where does the \"−\" go?",
          options: ["between 6 and 9","between 9 and 12","between 12 and 15","between 15 and 18","between 18 and 21"],
          answer: "between 15 and 18",
          solution: "Adding everything gives 6+9+12+15+18+21 = 81. We need to reduce this by 81−45 = 36. Changing a \"+\" to \"−\" before a number x reduces the total by 2x, so 2x=36 means x=18. The minus goes before 18, i.e. between 15 and 18.",
          subject: "algebra",
          level: "medium",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "The distance between two shelves in Monika's kitchen is 36 cm. A stack of 8 identical glasses is 42 cm high, and a stack of 2 such glasses is 18 cm high. How many glasses does the biggest stack have that will still fit between the two shelves?",
          options: ["3","4","5","6","7"],
          answer: "6",
          solution: "Each extra glass adds the same height d. From 8 glasses (42 cm) and 2 glasses (18 cm): 6d = 42−18 = 24, so d = 4 cm, and one glass alone is 18−4 = 14 cm. Height of n glasses = 14+4(n−1) = 10+4n. Setting 10+4n ≤ 36 gives n ≤ 6.5, so the biggest stack that fits has 6 glasses.",
          subject: "algebra",
          level: "medium",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "On an ordinary die, numbers on opposite sides always add up to 7. Four such dice are glued together in a straight row. All numbers still visible on the outside are added together. What is the minimum possible total?",
          options: ["52","54","56","58","60"],
          answer: "58",
          solution: "Each die's face values sum to 21, so four dice total 84. Each of the two interior dice has its two touching faces along the row's axis, which are always an opposite pair (summing to 7) — this hidden sum can't be improved by rotation. Each of the two end dice hides only one face, which can be rotated to show 6 there, hiding as much as possible. Minimum hidden = 7+7+6+6 = 26, so minimum visible = 84−26 = 58.",
          subject: "geometry",
          level: "medium",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "How many integers between 100 and 300 have only odd digits?",
          options: ["25","50","75","100","150"],
          answer: "25",
          solution: "For a number in this range to have only odd digits, the hundreds digit must be odd and the number must still be under 300, so the hundreds digit can only be 1. The tens and units digits can each be any of 1,3,5,7,9 (5 choices each). Total = 5×5 = 25.",
          subject: "number",
          level: "medium",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "There are two clocks in an office. One gains 1 minute every hour and the other loses 2 minutes every hour. Both were set to the correct time yesterday, but today one clock shows 11:00 and the other shows 12:00. At what time were they set yesterday?",
          options: ["23:00","19:40","15:40","14:00","11:20"],
          answer: "15:40",
          solution: "In t hours, the fast clock shows an elapsed time of t×61/60 hours and the slow clock t×58/60 hours. Their displayed times differ by t×3/60 hours, which must equal the 1-hour gap between 11:00 and 12:00, so t=20 hours. The fast clock then shows start+20h20min=12:00, giving a start time of 15:40 (confirmed by the slow clock: start+19h20min=11:00 also gives 15:40).",
          subject: "algebra",
          level: "medium",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "Werner has written down some numbers whose sum is 22. Ria subtracts each number from 7 and writes down the results; the sum of Ria's numbers is 34. How many numbers did Werner write down?",
          options: ["7","8","9","10","11"],
          answer: "8",
          solution: "If Werner wrote n numbers, the sum of Ria's numbers is 7n minus the sum of Werner's numbers: 7n − 22 = 34, so 7n = 56 and n = 8.",
          subject: "algebra",
          level: "medium",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "Two identical bricks can be joined face-to-face in three different ways, giving cuboids with surface areas 72, 96 and 102 cm². What is the surface area, in cm², of a single brick?",
          options: ["36","48","52","54","60"],
          answer: "54",
          solution: "If a single brick has surface area S, joining two bricks along one face removes two copies of that face's area from the total 2S. Summing the three joined surface areas counts every face-pair exactly once via 6S − 2(sum of the three face areas), and since the three face-pair areas of a cuboid sum to exactly S/2 × 2 = S, the three results add up to 5S. So 5S = 72+96+102 = 270, giving S = 54.",
          subject: "geometry",
          level: "medium",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "Jenny writes numbers into a 3×3 table so that the sums of the four numbers in each 2×2 area of the table are equal. Three of the four corner cells already show 2 (top-left), 4 (top-right) and 3 (bottom-right). What number goes in the bottom-left corner?",
          options: ["0","1","4","5","6"],
          answer: "1",
          solution: "For this kind of grid, equal 2×2 sums force the identity (top-left)+(bottom-right) = (top-right)+(bottom-left), regardless of the interior values. So 2+3 = 4+(bottom-left), giving bottom-left = 1.",
          subject: "algebra",
          level: "hard",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "A shape is made of a triangle and a circle that partially overlap. The grey overlapping area is 45% of the entire shape's area, and the white part of the triangle (not overlapping the circle) is 40% of the entire shape's area. What percentage of the circle's own area is white (i.e. outside the triangle)?",
          options: ["20%","25%","30%","35%","50%"],
          answer: "25%",
          solution: "Taking the whole shape as 100%: white-circle-part = 100 − 45 (grey) − 40 (white triangle) = 15%. The circle's total area = grey + white-circle-part = 45+15 = 60%. So the white part of the circle is 15/60 = 25% of the circle's own area.",
          subject: "geometry",
          level: "hard",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "By bike, Marc takes 20 minutes to go from home to school and back (constant speed); by foot the same round trip takes 60 minutes (constant speed). One day he biked partway to Eva's house (on the way to school), left the bike, and walked the rest of the way to school. Coming home he walked back to Eva's house, then biked the rest of the way home. The whole journey took 52 minutes. What fraction of the total distance (there and back) did he cover by bike?",
          options: ["1/6","1/5","1/4","1/3","1/2"],
          answer: "1/5",
          solution: "One-way biking takes 10 minutes, one-way walking takes 30 minutes. If a fraction f of the one-way distance is biked, each one-way leg (there or back) takes 10f + 30(1−f) minutes, and the whole day takes twice that: 2(10f+30(1−f)) = 52, giving 10f+30−30f=26, so f = 1/5. Since both the outward and return legs use the same fraction f by bike, the overall fraction covered by bike is also 1/5.",
          subject: "algebra",
          level: "hard",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "Villages A, B, C and D lie (in some order) along a straight road. A and C are 75 km apart, B and D are 45 km apart, and B and C are 20 km apart. Which of the following distances cannot be the distance from A to D?",
          options: ["10 km","50 km","80 km","100 km","140 km"],
          answer: "80 km",
          solution: "Placing C at 0, A is at +75 or −75, and B is at +20 or −20 (from C), with D at B±45. Checking all combinations, the possible values of |A−D| are exactly {10, 50, 100, 140} — 80 km never occurs.",
          subject: "algebra",
          level: "hard",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "A painter wants to mix 2 litres of blue paint with 3 litres of yellow paint to get 5 litres of green paint, but accidentally uses 3 litres of blue and 2 litres of yellow. What is the minimum amount of this wrong green paint he must throw away so that, after adding only more blue or yellow paint, he can end up with exactly 5 litres of the correct shade?",
          options: ["5/3 litre","3/2 litre","2/3 litre","3/5 litre","5/9 litre"],
          answer: "5/3 litre",
          solution: "After discarding X litres of the 3:2 mixture, the remaining blue is 3−0.6X and remaining yellow is 2−0.4X. Since he can only add paint (not remove more), he needs remaining blue ≤ 2 (the correct final blue amount): 3−0.6X ≤ 2, giving X ≥ 5/3. This is the binding constraint, so the minimum is 5/3 litre.",
          subject: "algebra",
          level: "hard",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "What is the minimum number of cells that must be coloured in a 5×5 grid so that every possible 1×4 rectangle and every 4×1 rectangle within the grid contains at least one coloured cell?",
          options: ["5","6","7","8","9"],
          answer: "6",
          solution: "Each row has two overlapping 1×4 windows, and each column has two overlapping 4×1 windows — 20 windows in total that must each contain a coloured cell. A careful arrangement of just 6 coloured cells can hit every one of these windows, and no arrangement of 5 cells can (checked exhaustively).",
          subject: "logic",
          level: "hard",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "A bear always lies on Monday, Tuesday and Wednesday (and tells the truth on other days). A panther always lies on Thursday, Friday and Saturday (and tells the truth on other days). The bear says \"Yesterday was one of my lying days\" and the panther says \"Yesterday was also one of my lying days.\" On which day did this conversation take place?",
          options: ["Thursday","Friday","Saturday","Sunday","Monday"],
          answer: "Thursday",
          solution: "Checking each day of the week for whether the bear's statement matches whether the bear is truthful that day, and likewise for the panther, only Thursday makes both statements consistent with each animal's own lying schedule.",
          subject: "logic",
          level: "hard",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "Some points are marked on a line. Renate marks another point between every pair of adjacent points, and repeats this process three more times (four times in total). Now there are 225 points. How many points were there to begin with?",
          options: ["10","12","15","16","25"],
          answer: "15",
          solution: "Each round transforms a count of k points into 2k−1 points (a new point is added in each of the k−1 gaps). Reversing four rounds from 225: 225→113→57→29→15. So there were 15 points to begin with.",
          subject: "number",
          level: "hard",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "There are 2022 kangaroos and some koalas living in seven parks. In each park, the number of kangaroos equals the number of koalas in all the other parks combined. How many koalas in total live in the seven parks?",
          options: ["288","337","576","674","2022"],
          answer: "337",
          solution: "If K is the total number of koalas, the kangaroos in park i equal K minus the koalas in park i. Summing over all seven parks, total kangaroos = 7K − K = 6K = 2022, so K = 337.",
          subject: "algebra",
          level: "hard",
          source: "Kangaroo 2022 Austria"
        },
        {
          text: "What is the value of (20×21) ÷ (2+0+2+1)?",
          options: ["42","64","80","84","105"],
          answer: "84",
          solution: "20×21 = 420, and 2+0+2+1 = 5. So the answer is 420 ÷ 5 = 84.",
          subject: "number",
          level: "easy",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "How many four-digit numbers have digits that are consecutive and strictly increasing from left to right (like 2345)?",
          options: ["5","6","7","8","9"],
          answer: "6",
          solution: "If the first digit is d, the digits are d, d+1, d+2, d+3, which all stay within 0-9 only when d is 1 through 6 (d can't be 0, since the number would then not be a genuine four-digit number). This gives 1234, 2345, 3456, 4567, 5678, 6789 — 6 numbers.",
          subject: "number",
          level: "easy",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "A student correctly added two two-digit numbers, AB and CD, and got 137. What answer would he get if he added the four-digit numbers ADCB and CBAD (formed from the same digits A, B, C, D)?",
          options: ["13 737","13 837","14 747","23 737","137 137"],
          answer: "13 837",
          solution: "ADCB + CBAD = 1010(A+C) + 101(B+D) = 101×(10(A+C)+(B+D)) = 101×(AB+CD) = 101×137 = 13 837 — this holds for any digits satisfying AB+CD=137.",
          subject: "algebra",
          level: "easy",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "Byron is 5cm taller than Aaron but 10cm shorter than Caron. Darren is 10cm taller than Caron but 5cm shorter than Erin. Which statement is true?",
          options: ["Aaron and Erin are equal heights","Aaron is 10cm taller than Erin","Aaron is 10cm shorter than Erin","Aaron is 30cm taller than Erin","Aaron is 30cm shorter than Erin"],
          answer: "Aaron is 30cm shorter than Erin",
          solution: "Let Aaron = x. Then Byron = x+5, Caron = Byron+10 = x+15, Darren = Caron+10 = x+25, Erin = Darren+5 = x+30. So Erin is 30cm taller than Aaron, i.e. Aaron is 30cm shorter than Erin.",
          subject: "algebra",
          level: "easy",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "A rectangular chocolate bar is made of equal squares. Neil breaks off two complete strips of squares and eats the 12 squares he gets. Later, Jack breaks off one complete strip from the same bar and eats the 9 squares he gets. How many squares are left in the bar?",
          options: ["72","63","54","45","36"],
          answer: "45",
          solution: "Neil's two strips give 12 squares, so each strip (a full row) has 6 squares — the bar is 6 squares wide. After Neil removes 2 rows, Jack's strip (a full column of the remaining bar) has 9 squares, so the remaining height is 9 rows, making the original height 9+2=11 rows. The original bar had 6×11=66 squares; after removing 12+9=21, there are 66−21=45 squares left.",
          subject: "number",
          level: "medium",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "A jar one-fifth filled with water weighs 560g. The same jar four-fifths filled with water weighs 740g. What is the weight of the empty jar?",
          options: ["60 g","112 g","180 g","300 g","500 g"],
          answer: "500 g",
          solution: "The extra 3/5 of the jar's water weighs 740−560=180g, so a full jar of water weighs 300g. The empty jar weighs 560 minus one-fifth of 300 (=60), which is 500g.",
          subject: "algebra",
          level: "medium",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "Costa builds a fence from 25 planks, each 30cm long, with the same slight overlap between every pair of adjacent planks. The total fence length is 6.9 metres (690cm). What is the overlap, in cm, between adjacent planks?",
          options: ["2,4","2,5","3","4,8","5"],
          answer: "2,5",
          solution: "With 25 planks there are 24 overlaps. Total length = 25×30 − 24×overlap = 690, so 750 − 24×overlap = 690, giving overlap = 60/24 = 2.5cm.",
          subject: "algebra",
          level: "medium",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "Five identical right-angled triangles form a star when their larger acute angles all touch at the centre. How many of these triangles are needed to form a different star where their smaller acute angles all touch at the centre instead?",
          options: ["10","12","18","20","24"],
          answer: "20",
          solution: "Five copies of the larger acute angle meeting at a point sum to 360°, so the larger acute angle is 360/5=72°. Since it's a right triangle, the smaller acute angle is 90−72=18°. To surround a point with copies of an 18° angle needs 360/18=20 triangles.",
          subject: "geometry",
          level: "medium",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "There are 20 questions in a quiz. Each correct answer scores 7 points, each wrong answer scores −4 points, and each blank answer scores 0. Eric scored 100 points in total. How many questions did he leave blank?",
          options: ["0","1","2","3","4"],
          answer: "1",
          solution: "With c correct, w wrong and b blank (c+w+b=20) and 7c−4w=100, the only solution with all values non-negative is c=16, w=3, b=1.",
          subject: "algebra",
          level: "medium",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "A box of fruit contains twice as many apples as pears. Christy and Lily divided all the fruit so that Christy ended up with twice as many pieces of fruit as Lily. Which statement must always be true?",
          options: ["Christy took at least one pear.","Christy took twice as many apples as pears.","Christy took twice as many apples as Lily.","Christy took as many apples as Lily got pears.","Christy took as many pears as Lily got apples."],
          answer: "Christy took as many pears as Lily got apples.",
          solution: "Let total pears = p, apples = 2p, so total fruit = 3p, meaning Christy has 2p pieces and Lily has p pieces. If Christy's pears = p_C, her apples = 2p−p_C. Lily's apples = 2p − Christy's apples = p_C exactly. So Christy's pears always equal Lily's apples — this holds regardless of the specific split.",
          subject: "algebra",
          level: "medium",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "Three villages, Downend, Uphill and Middleton, are connected by direct paths. From Downend to Uphill, the detour via Middleton is 1km longer than the direct path. From Downend to Middleton, the detour via Uphill is 5km longer than the direct path. From Uphill to Middleton, the detour via Downend is 7km longer than the direct path. How long is the shortest of the three direct paths?",
          options: ["1 km","2 km","3 km","4 km","5 km"],
          answer: "3 km",
          solution: "Let the direct distances be DU, DM, UM. The conditions give DM+UM=DU+1, DU+UM=DM+5, DU+DM=UM+7. Adding all three: DU+DM+UM=13. Solving the system gives DU=6, DM=4, UM=3. The shortest direct path is Uphill–Middleton at 3 km.",
          subject: "algebra",
          level: "medium",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "In a fraction, both the numerator and denominator are positive. The numerator is increased by 40%. By what percentage should the denominator be decreased so that the new fraction is double the original fraction?",
          options: ["10%","20%","30%","40%","50%"],
          answer: "30%",
          solution: "If the original fraction is N/D, the new numerator is 1.4N. We need 1.4N/D' = 2(N/D), so D' = 0.7D — a 30% decrease.",
          subject: "number",
          level: "hard",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "The 6-digit number 2ABCDE is multiplied by 3, giving the 6-digit number ABCDE2. What is the sum of the digits of this number?",
          options: ["24","27","30","33","36"],
          answer: "27",
          solution: "Writing X=ABCDE, we need 3(200000+X)=10X+2, which gives 7X=599998, so X=85714. Then 2ABCDE=285714 and ABCDE2=857142 (indeed 285714×3=857142). Both use the digits 2,8,5,7,1,4, whose sum is 27.",
          subject: "number",
          level: "hard",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "A box contains only green, red, blue and yellow counters. Any 27 counters chosen always include at least one green; any 25 always include at least one red; any 22 always include at least one blue; any 17 always include at least one yellow. What is the largest possible number of counters in the box?",
          options: ["27","29","51","87","91"],
          answer: "29",
          solution: "The conditions mean: (red+blue+yellow) ≤ 26, (green+blue+yellow) ≤ 24, (green+red+yellow) ≤ 21, (green+red+blue) ≤ 16. Adding all four inequalities gives 3×(total) ≤ 87, so total ≤ 29 — and 29 is achievable (e.g. green=3, red=5, blue=8, yellow=13).",
          subject: "logic",
          level: "hard",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "2021 kangaroos, numbered 1 to 2021, are each coloured red, grey or blue so that any three consecutive kangaroos include all three colours. Bruce guesses: kangaroo 2 is grey, kangaroo 20 is blue, kangaroo 202 is red, kangaroo 1002 is blue, kangaroo 2021 is grey — and only one guess is wrong. Which kangaroo's colour did he guess incorrectly?",
          options: ["2","20","202","1002","2021"],
          answer: "20",
          solution: "The \"any 3 consecutive have all 3 colours\" rule forces the colouring to repeat with period 3. Kangaroos 2, 20 and 2021 all share the same position in that 3-cycle (since 2, 20 and 2021 all leave remainder 2 when divided by 3), so they must all be the same colour. Since 2 and 2021 both being \"grey\" agree, kangaroo 20's guess of \"blue\" must be the single error.",
          subject: "logic",
          level: "hard",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "A 3×4×5 cuboid is made of 60 identical small cubes. A termite eats along the space diagonal from one corner to the opposite corner (which passes through no internal edges). How many small cubes does it pass through?",
          options: ["8","9","10","11","12"],
          answer: "10",
          solution: "The number of unit cubes a space diagonal crosses in an a×b×c box is a+b+c−gcd(a,b)−gcd(b,c)−gcd(a,c)+gcd(a,b,c). For 3,4,5 (all pairwise coprime): 3+4+5−1−1−1+1 = 10.",
          subject: "geometry",
          level: "hard",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "In a town there are 21 knights (always truthful) and 2000 knaves (always lying). A wizard paired up 2020 of these 2021 people into 1010 pairs; each person described their partner as a knight or a knave. In total, 2000 people were called \"knight\" and 20 were called \"knave.\" How many pairs consisted of two knaves?",
          options: ["980","985","990","995","1000"],
          answer: "995",
          solution: "A knight-knight pair calls each other \"knight\" (2 knight-labels); a mixed pair has both people called \"knave\" (the knight truthfully calls the knave a knave, and the knave lies about the knight, also calling them \"knave\"); a knave-knave pair calls each other \"knight\" (2 knight-labels), since each must lie about the other's true \"knave\" status. So mixed pairs = 20÷2 = 10. The 1 unpaired person must be a knight (to make the knight-count work out), leaving 20 knights across 1010 pairs: 2×(knight-knight pairs)+10=20, so knight-knight pairs=5, and knave-knave pairs = 1010−10−5 = 995.",
          subject: "logic",
          level: "hard",
          source: "Kangaroo 2021 Brazil"
        },
        {
          text: "In a 6-team round-robin tournament (each team plays every other team once), each round has 3 simultaneous matches over 5 rounds. A TV station picked one match per round to broadcast: round 1: A-B, round 2: C-D, round 3: A-E, round 4: E-F, round 5: A-C. In which round do teams D and F play each other?",
          options: ["1","2","3","4","5"],
          answer: "1",
          solution: "Team A's five opponents across the rounds must be B, C, D, E, F in some order; from the known matches A already has B (round1), E (round3) and C (round5), leaving D and F for rounds 2 and 4. Since round 2 already has C-D and round 4 already has E-F, A must play F in round 2 and D in round 4. Working through the remaining pairings so every pair of teams meets exactly once shows the unique valid schedule has D playing F in round 1.",
          subject: "logic",
          level: "hard",
          source: "Kangaroo 2021 Brazil"
        }
      ];

      for (const q of kangarooPdfQuestions) {
        await pool.query(
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source, subject, level)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          ['kangaroo', 'multipleChoice', q.text, q.answer, JSON.stringify(q.options), q.solution, q.source, q.subject, q.level]
        );
      }
      console.log('Seeded 40 verified Kangaroo questions from real competition papers');
    }

    // Seed tiered easy/medium/hard practice questions for Year 6, 7 and 8
    // (idempotent), so each year level supports the same difficulty-tier
    // selection as the Kangaroo bank.
    const yearTierCheck = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE source = 'Year Tier Practice Bank'"
    );
    if (parseInt(yearTierCheck.rows[0].count) === 0) {
      const yearTierQuestions = [
        {
          difficulty: "year6",
          level: "easy",
          type: "multipleChoice",
          text: "What is 10% of 50?",
          answer: "5",
          options: ["8","5","45","10","0"],
          solution: "10% of 50 = (10/100) × 50 = 5.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "easy",
          type: "multipleChoice",
          text: "What is 20% of 40?",
          answer: "8",
          options: ["3","32","13","12","8"],
          solution: "20% of 40 = (20/100) × 40 = 8.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "easy",
          type: "multipleChoice",
          text: "What is 25% of 80?",
          answer: "20",
          options: ["60","15","20","25","28"],
          solution: "25% of 80 = (25/100) × 80 = 20.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "easy",
          type: "multipleChoice",
          text: "What is 50% of 60?",
          answer: "30",
          options: ["35","25","30","33","36"],
          solution: "50% of 60 = (50/100) × 60 = 30.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "easy",
          type: "multipleChoice",
          text: "What is 10% of 90?",
          answer: "9",
          options: ["14","4","18","81","9"],
          solution: "10% of 90 = (10/100) × 90 = 9.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "easy",
          type: "multipleChoice",
          text: "What is 24 ÷ 8?",
          answer: "3",
          options: ["32","16","2","3","4"],
          solution: "24 ÷ 8 = 3.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "easy",
          type: "multipleChoice",
          text: "What is 36 ÷ 9?",
          answer: "4",
          options: ["45","3","27","5","4"],
          solution: "36 ÷ 9 = 4.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "easy",
          type: "multipleChoice",
          text: "What is 45 ÷ 5?",
          answer: "9",
          options: ["10","40","9","50","8"],
          solution: "45 ÷ 5 = 9.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "medium",
          type: "shortAnswer",
          text: "A rectangle has length 9cm and width 5cm. What is its perimeter?",
          answer: "28",
          options: null,
          solution: "Perimeter = 2 × (length + width) = 2 × (9+5) = 28 cm.",
          subject: "geometry"
        },
        {
          difficulty: "year6",
          level: "medium",
          type: "shortAnswer",
          text: "A rectangle has area 42 cm² and length 7 cm. What is its width?",
          answer: "6",
          options: null,
          solution: "Width = area ÷ length = 42 ÷ 7 = 6 cm.",
          subject: "geometry"
        },
        {
          difficulty: "year6",
          level: "medium",
          type: "shortAnswer",
          text: "Sarah buys 3 notebooks at £2 each and 2 pens at £1.50 each. How much does she spend in total?",
          answer: "9",
          options: null,
          solution: "3 × £2 = £6. 2 × £1.50 = £3. Total = £6 + £3 = £9.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "medium",
          type: "shortAnswer",
          text: "A ribbon 84 cm long is cut into pieces of 12 cm each. How many pieces are there?",
          answer: "7",
          options: null,
          solution: "84 ÷ 12 = 7 pieces.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "medium",
          type: "multipleChoice",
          text: "A class has 12 boys and 18 girls. What fraction of the class are boys?",
          answer: "2/5",
          options: ["3/5","2/5","2/3","1/2","1/3"],
          solution: "Total students = 12+18 = 30. Fraction of boys = 12/30 = 2/5.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "medium",
          type: "shortAnswer",
          text: "Find the missing number: 4, 8, 16, 32, ?",
          answer: "64",
          options: null,
          solution: "The rule is: double each time. 32 × 2 = 64.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "medium",
          type: "shortAnswer",
          text: "What is the perimeter of a square with area 49 cm²?",
          answer: "28",
          options: null,
          solution: "Side = √49 = 7 cm. Perimeter = 4 × 7 = 28 cm.",
          subject: "geometry"
        },
        {
          difficulty: "year6",
          level: "medium",
          type: "shortAnswer",
          text: "A recipe needs 250g of flour to make 10 cakes. How much flour is needed for 25 cakes?",
          answer: "625",
          options: null,
          solution: "Flour per cake = 250 ÷ 10 = 25g. For 25 cakes: 25 × 25 = 625g.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "hard",
          type: "shortAnswer",
          text: "The sum of two numbers is 45 and their difference is 9. What is the larger number?",
          answer: "27",
          options: null,
          solution: "Larger = (45+9)/2 = 27.",
          subject: "algebra"
        },
        {
          difficulty: "year6",
          level: "hard",
          type: "shortAnswer",
          text: "A tank is 2/5 full of water. After adding 30 litres, it becomes 4/5 full. What is the tank's total capacity, in litres?",
          answer: "75",
          options: null,
          solution: "The added water fills 4/5 − 2/5 = 2/5 of the tank, so 2/5 of the tank = 30 litres. The full tank = 30 ÷ 2 × 5 = 75 litres.",
          subject: "algebra"
        },
        {
          difficulty: "year6",
          level: "hard",
          type: "shortAnswer",
          text: "In a class of 40 students, 60% passed a test on the first try. Of those who failed, half passed on a retake. How many students still had not passed after the retake?",
          answer: "8",
          options: null,
          solution: "60% of 40 = 24 passed initially, leaving 16 who failed. Half of 16 = 8 passed on the retake, leaving 16−8=8 who still hadn't passed.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "hard",
          type: "shortAnswer",
          text: "A rectangular garden is 3 times as long as it is wide. Its perimeter is 64 m. What is the width, in metres?",
          answer: "8",
          options: null,
          solution: "Let width=w, length=3w. Perimeter = 2(w+3w) = 8w = 64, so w = 8 m.",
          subject: "geometry"
        },
        {
          difficulty: "year6",
          level: "hard",
          type: "shortAnswer",
          text: "Three friends share £120 in the ratio 2:3:5. How much does the friend with the largest share receive?",
          answer: "60",
          options: null,
          solution: "Total parts = 2+3+5=10. Each part = 120÷10=£12. Largest share = 5×£12 = £60.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "hard",
          type: "shortAnswer",
          text: "A number is increased by 20% and then decreased by 20%. If the final result is 96, what was the original number?",
          answer: "100",
          options: null,
          solution: "Increasing by 20% then decreasing by 20% multiplies the original by 1.2×0.8=0.96. So original = 96 ÷ 0.96 = 100.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "hard",
          type: "shortAnswer",
          text: "The average of 5 numbers is 18. If one more number is added, the new average becomes 20. What was the number added?",
          answer: "30",
          options: null,
          solution: "Original total = 5×18=90. New total (6 numbers) = 6×20=120. Added number = 120−90=30.",
          subject: "number"
        },
        {
          difficulty: "year6",
          level: "hard",
          type: "shortAnswer",
          text: "A shop reduces a £80 jacket by 25% in a sale, then reduces the sale price by a further 10%. What is the final price, in pounds?",
          answer: "54",
          options: null,
          solution: "After 25% off: £80 × 0.75 = £60. After a further 10% off: £60 × 0.9 = £54.",
          subject: "number"
        },
        {
          difficulty: "year7",
          level: "easy",
          type: "shortAnswer",
          text: "Solve for x: 4x + 7 = 27",
          answer: "5",
          options: null,
          solution: "4x = 27−7 = 20. x = 20÷4 = 5.",
          subject: "algebra"
        },
        {
          difficulty: "year7",
          level: "easy",
          type: "shortAnswer",
          text: "Solve for x: 3x − 8 = 13",
          answer: "7",
          options: null,
          solution: "3x = 13+8 = 21. x = 21÷3 = 7.",
          subject: "algebra"
        },
        {
          difficulty: "year7",
          level: "easy",
          type: "multipleChoice",
          text: "What is -7 + 12?",
          answer: "5",
          options: ["19","7","-19","-5","5"],
          solution: "-7 + 12 = 5.",
          subject: "number"
        },
        {
          difficulty: "year7",
          level: "easy",
          type: "multipleChoice",
          text: "What is -3 × -6?",
          answer: "18",
          options: ["-18","-9","9","18","3"],
          solution: "A negative times a negative gives a positive: -3 × -6 = 18.",
          subject: "number"
        },
        {
          difficulty: "year7",
          level: "easy",
          type: "shortAnswer",
          text: "What is 30% of 150?",
          answer: "45",
          options: null,
          solution: "30% of 150 = 0.3 × 150 = 45.",
          subject: "number"
        },
        {
          difficulty: "year7",
          level: "easy",
          type: "shortAnswer",
          text: "Simplify: 5x + 3x − 2x",
          answer: "6x",
          options: null,
          solution: "5x+3x−2x = (5+3−2)x = 6x.",
          subject: "algebra"
        },
        {
          difficulty: "year7",
          level: "easy",
          type: "shortAnswer",
          text: "What is the value of 3² + 4²?",
          answer: "25",
          options: null,
          solution: "3²=9, 4²=16, so 9+16=25.",
          subject: "number"
        },
        {
          difficulty: "year7",
          level: "easy",
          type: "shortAnswer",
          text: "A triangle has angles of 55° and 65°. What is the third angle?",
          answer: "60",
          options: null,
          solution: "Angles in a triangle sum to 180°. Third angle = 180−55−65 = 60°.",
          subject: "geometry"
        },
        {
          difficulty: "year7",
          level: "medium",
          type: "shortAnswer",
          text: "Solve for x: 2(x + 5) = 22",
          answer: "6",
          options: null,
          solution: "2x+10=22, 2x=12, x=6.",
          subject: "algebra"
        },
        {
          difficulty: "year7",
          level: "medium",
          type: "shortAnswer",
          text: "Expand: 4(2x − 3)",
          answer: "8x - 12",
          options: null,
          solution: "4×2x=8x, 4×(−3)=−12, so 4(2x−3)=8x−12.",
          subject: "algebra"
        },
        {
          difficulty: "year7",
          level: "medium",
          type: "shortAnswer",
          text: "A right-angled triangle has legs 9cm and 12cm. What is the length of its hypotenuse?",
          answer: "15",
          options: null,
          solution: "Hypotenuse² = 9²+12² = 81+144 = 225. Hypotenuse = √225 = 15 cm.",
          subject: "geometry"
        },
        {
          difficulty: "year7",
          level: "medium",
          type: "shortAnswer",
          text: "What is the HCF (highest common factor) of 48 and 60?",
          answer: "12",
          options: null,
          solution: "48=2⁴×3, 60=2²×3×5. HCF = 2²×3 = 12.",
          subject: "number"
        },
        {
          difficulty: "year7",
          level: "medium",
          type: "shortAnswer",
          text: "What is the LCM (lowest common multiple) of 8 and 12?",
          answer: "24",
          options: null,
          solution: "8=2³, 12=2²×3. LCM=2³×3=24.",
          subject: "number"
        },
        {
          difficulty: "year7",
          level: "medium",
          type: "shortAnswer",
          text: "A car travels 180km in 3 hours. At the same speed, how long does it take to travel 300km?",
          answer: "5",
          options: null,
          solution: "Speed = 180÷3 = 60 km/h. Time for 300km = 300÷60 = 5 hours.",
          subject: "number"
        },
        {
          difficulty: "year7",
          level: "medium",
          type: "multipleChoice",
          text: "A bag has 4 red, 3 blue and 5 green balls. What is the probability of picking a blue ball at random?",
          answer: "1/4",
          options: ["1/4","3/5","1/5","1/3","1/2"],
          solution: "Total balls = 4+3+5=12. P(blue) = 3/12 = 1/4.",
          subject: "logic"
        },
        {
          difficulty: "year7",
          level: "medium",
          type: "shortAnswer",
          text: "Simplify: (3x²) × (4x³)",
          answer: "12x^5",
          options: null,
          solution: "3×4=12, and x²×x³=x⁵, so the result is 12x⁵.",
          subject: "algebra"
        },
        {
          difficulty: "year7",
          level: "hard",
          type: "shortAnswer",
          text: "Solve for x: 5x − 3 = 3x + 11",
          answer: "7",
          options: null,
          solution: "5x−3x=11+3, 2x=14, x=7.",
          subject: "algebra"
        },
        {
          difficulty: "year7",
          level: "hard",
          type: "shortAnswer",
          text: "Factorise: x² + 7x + 10",
          answer: "(x + 2)(x + 5)",
          options: null,
          solution: "Two numbers that multiply to 10 and add to 7 are 2 and 5, so x²+7x+10=(x+2)(x+5).",
          subject: "algebra"
        },
        {
          difficulty: "year7",
          level: "hard",
          type: "shortAnswer",
          text: "The angles of a triangle are in the ratio 2:3:4. What is the size of the largest angle?",
          answer: "80",
          options: null,
          solution: "Total parts = 2+3+4=9. Each part=180÷9=20°. Largest angle=4×20=80°.",
          subject: "geometry"
        },
        {
          difficulty: "year7",
          level: "hard",
          type: "shortAnswer",
          text: "A number x satisfies 3(x-2) = 2(x+5). Find x.",
          answer: "16",
          options: null,
          solution: "3x−6=2x+10, so 3x−2x=10+6, x=16.",
          subject: "algebra"
        },
        {
          difficulty: "year7",
          level: "hard",
          type: "shortAnswer",
          text: "Find the remainder when 2^20 is divided by 5.",
          answer: "1",
          options: null,
          solution: "Powers of 2 mod 5 cycle as 2,4,3,1 (period 4). 20 is a multiple of 4, so 2^20 mod5 = the 4th term = 1.",
          subject: "number"
        },
        {
          difficulty: "year7",
          level: "hard",
          type: "shortAnswer",
          text: "Two numbers have HCF 6 and LCM 90. If one number is 18, what is the other?",
          answer: "30",
          options: null,
          solution: "Product of two numbers = HCF × LCM = 6×90=540. Other number = 540÷18=30.",
          subject: "number"
        },
        {
          difficulty: "year7",
          level: "hard",
          type: "shortAnswer",
          text: "A shape's perimeter is 60cm. Its length is twice its width plus 3cm. Find the width, in cm.",
          answer: "9",
          options: null,
          solution: "Let width=w, length=2w+3. Perimeter=2(w+2w+3)=2(3w+3)=6w+6=60, so 6w=54, w=9.",
          subject: "algebra"
        },
        {
          difficulty: "year7",
          level: "hard",
          type: "shortAnswer",
          text: "The mean of 4 numbers is 15. Three of the numbers are 10, 14 and 18. What is the fourth number?",
          answer: "18",
          options: null,
          solution: "Total = 4×15=60. Sum of known three = 10+14+18=42. Fourth number = 60−42=18.",
          subject: "number"
        },
        {
          difficulty: "year8",
          level: "easy",
          type: "shortAnswer",
          text: "Solve for x: 6x - 9 = 21",
          answer: "5",
          options: null,
          solution: "6x=30, x=5.",
          subject: "algebra"
        },
        {
          difficulty: "year8",
          level: "easy",
          type: "shortAnswer",
          text: "Expand: 5(3x + 2)",
          answer: "15x + 10",
          options: null,
          solution: "5×3x=15x, 5×2=10.",
          subject: "algebra"
        },
        {
          difficulty: "year8",
          level: "easy",
          type: "shortAnswer",
          text: "What is 4³?",
          answer: "64",
          options: null,
          solution: "4³=4×4×4=64.",
          subject: "number"
        },
        {
          difficulty: "year8",
          level: "easy",
          type: "shortAnswer",
          text: "Simplify: 7y - 2y + 5y",
          answer: "10y",
          options: null,
          solution: "7y−2y+5y=(7−2+5)y=10y.",
          subject: "algebra"
        },
        {
          difficulty: "year8",
          level: "easy",
          type: "shortAnswer",
          text: "What is the area of a triangle with base 10cm and height 6cm?",
          answer: "30",
          options: null,
          solution: "Area = ½ × base × height = ½×10×6=30 cm².",
          subject: "geometry"
        },
        {
          difficulty: "year8",
          level: "easy",
          type: "shortAnswer",
          text: "What is 60% of 90?",
          answer: "54",
          options: null,
          solution: "60% of 90 = 0.6×90=54.",
          subject: "number"
        },
        {
          difficulty: "year8",
          level: "easy",
          type: "shortAnswer",
          text: "Find the median of: 3, 7, 9, 12, 15",
          answer: "9",
          options: null,
          solution: "Sorted, the middle value of 5 numbers is the 3rd one: 9.",
          subject: "number"
        },
        {
          difficulty: "year8",
          level: "easy",
          type: "multipleChoice",
          text: "What is 5⁻¹ as a fraction?",
          answer: "1/5",
          options: ["1/5","5","0","-1/5","-5"],
          solution: "A negative exponent gives the reciprocal: 5⁻¹ = 1/5.",
          subject: "number"
        },
        {
          difficulty: "year8",
          level: "medium",
          type: "shortAnswer",
          text: "Solve: 3(x - 4) = 2(x + 1)",
          answer: "14",
          options: null,
          solution: "3x−12=2x+2, x=14.",
          subject: "algebra"
        },
        {
          difficulty: "year8",
          level: "medium",
          type: "shortAnswer",
          text: "Factorise: x² - 9",
          answer: "(x - 3)(x + 3)",
          options: null,
          solution: "This is a difference of two squares: x²−9=x²−3²=(x−3)(x+3).",
          subject: "algebra"
        },
        {
          difficulty: "year8",
          level: "medium",
          type: "shortAnswer",
          text: "A right-angled triangle has hypotenuse 25cm and one leg 7cm. What is the length of the other leg, in cm?",
          answer: "24",
          options: null,
          solution: "Other leg² = 25²−7²=625−49=576. √576=24.",
          subject: "geometry"
        },
        {
          difficulty: "year8",
          level: "medium",
          type: "shortAnswer",
          text: "The mean of 6 numbers is 12. Find the sum of the 6 numbers.",
          answer: "72",
          options: null,
          solution: "Sum = mean × count = 12×6=72.",
          subject: "number"
        },
        {
          difficulty: "year8",
          level: "medium",
          type: "shortAnswer",
          text: "Simplify: (2x³) × (5x²)",
          answer: "10x^5",
          options: null,
          solution: "2×5=10, x³×x²=x⁵.",
          subject: "algebra"
        },
        {
          difficulty: "year8",
          level: "medium",
          type: "shortAnswer",
          text: "A cylinder has radius 4cm and height 10cm. Find its volume in terms of π.",
          answer: "160π",
          options: null,
          solution: "Volume = πr²h = π×16×10=160π cm³.",
          subject: "geometry"
        },
        {
          difficulty: "year8",
          level: "medium",
          type: "shortAnswer",
          text: "What is the interior angle of a regular decagon (10 sides)?",
          answer: "144",
          options: null,
          solution: "Interior angle sum = (10−2)×180=1440°. Each angle = 1440÷10=144°.",
          subject: "geometry"
        },
        {
          difficulty: "year8",
          level: "medium",
          type: "shortAnswer",
          text: "Solve the simultaneous equations: x+y=10 and x−y=4. Find x.",
          answer: "7",
          options: null,
          solution: "Adding the equations: 2x=14, so x=7.",
          subject: "algebra"
        },
        {
          difficulty: "year8",
          level: "hard",
          type: "shortAnswer",
          text: "Solve: x² − 5x + 6 = 0. Give the larger solution.",
          answer: "3",
          options: null,
          solution: "Factorising: (x−2)(x−3)=0, so x=2 or x=3. The larger solution is 3.",
          subject: "algebra"
        },
        {
          difficulty: "year8",
          level: "hard",
          type: "shortAnswer",
          text: "Expand and simplify: (x + 3)(x - 5)",
          answer: "x^2 - 2x - 15",
          options: null,
          solution: "(x+3)(x−5) = x²−5x+3x−15 = x²−2x−15.",
          subject: "algebra"
        },
        {
          difficulty: "year8",
          level: "hard",
          type: "shortAnswer",
          text: "A ladder 17m long leans against a wall with its foot 8m from the wall. How high up the wall does it reach, in metres?",
          answer: "15",
          options: null,
          solution: "Height² = 17²−8²=289−64=225. √225=15.",
          subject: "geometry"
        },
        {
          difficulty: "year8",
          level: "hard",
          type: "shortAnswer",
          text: "Solve for x: (x/3) + (x/4) = 7",
          answer: "12",
          options: null,
          solution: "Multiply through by 12: 4x+3x=84, so 7x=84, x=12.",
          subject: "algebra"
        },
        {
          difficulty: "year8",
          level: "hard",
          type: "shortAnswer",
          text: "Find the number of trailing zeros in 50!.",
          answer: "12",
          options: null,
          solution: "Trailing zeros = ⌊50/5⌋+⌊50/25⌋ = 10+2 = 12.",
          subject: "number"
        },
        {
          difficulty: "year8",
          level: "hard",
          type: "shortAnswer",
          text: "A car depreciates by 15% each year. If it costs £20,000 new, what is its value after 2 years, to the nearest pound?",
          answer: "14450",
          options: null,
          solution: "After year 1: £20,000×0.85=£17,000. After year 2: £17,000×0.85=£14,450.",
          subject: "number"
        },
        {
          difficulty: "year8",
          level: "hard",
          type: "shortAnswer",
          text: "The perimeter of a rectangle is 50cm and its area is 150cm². What is the length of the longer side, in cm?",
          answer: "15",
          options: null,
          solution: "Let length=l, width=w. 2(l+w)=50 so l+w=25. lw=150. Solving: l and w are roots of t²−25t+150=0, giving t=10 or t=15. The longer side is 15cm.",
          subject: "geometry"
        },
        {
          difficulty: "year8",
          level: "hard",
          type: "shortAnswer",
          text: "Two similar triangles have corresponding sides in ratio 2:5. If the area of the smaller triangle is 12cm², what is the area of the larger triangle?",
          answer: "75",
          options: null,
          solution: "Area ratio = (side ratio)² = (2:5)² = 4:25. Larger area = 12 × (25/4) = 75 cm².",
          subject: "geometry"
        }
      ];

      for (const q of yearTierQuestions) {
        await pool.query(
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source, subject, level)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [q.difficulty, q.type, q.text, q.answer, q.options ? JSON.stringify(q.options) : null, q.solution, 'Year Tier Practice Bank', q.subject, q.level]
        );
      }
      console.log('Seeded 72 tiered Year 6/7/8 practice questions');
    }

    // Seed a broad topic-coverage pack (idempotent) — ratios, probability,
    // place value, geometry, algebra and problem solving, at every year
    // (6/7/8) and difficulty tier (easy/medium/hard), so each tier's question
    // pool is large and varied enough that a 15-question paper doesn't repeat.
    const topicPackCheck = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE source = 'Topic Coverage Pack'"
    );
    if (parseInt(topicPackCheck.rows[0].count) === 0) {
      const topicPackQuestions = [
        // ------------------------------ RATIOS ------------------------------
        { difficulty: "year6", level: "easy", text: "Simplify the ratio 8:12 to its simplest form.", answer: "2:3", solution: "8 and 12 share a highest common factor of 4. 8÷4=2, 12÷4=3, so 8:12 = 2:3.", subject: "ratios" },
        { difficulty: "year6", level: "easy", text: "Share £20 between Amy and Ben in the ratio 2:3. How much does Ben get, in pounds?", answer: "12", solution: "2+3=5 parts, so each part is £20÷5=£4. Ben has 3 parts: 3×£4=£12.", subject: "ratios" },
        { difficulty: "year6", level: "medium", text: "A recipe uses flour and sugar in the ratio 3:2. If you use 150g of sugar, how much flour do you need, in grams?", answer: "225", solution: "150g of sugar is 2 parts, so 1 part = 75g. Flour is 3 parts: 3×75=225g.", subject: "ratios" },
        { difficulty: "year6", level: "medium", text: "Simplify the ratio 18:24:30 to its simplest form.", answer: "3:4:5", solution: "18, 24 and 30 share a highest common factor of 6. Dividing each by 6 gives 3:4:5.", subject: "ratios" },
        { difficulty: "year6", level: "hard", text: "Three friends share £84 in the ratio 2:3:7. How much does the person with the largest share get, in pounds?", answer: "49", solution: "2+3+7=12 parts, so each part is £84÷12=£7. The largest share is 7 parts: 7×£7=£49.", subject: "ratios" },
        { difficulty: "year6", level: "hard", text: "The ratio of red paint to blue paint is 5:3. If there are 40 litres of red paint, how many litres of blue paint are needed?", answer: "24", solution: "40 litres is 5 parts, so 1 part = 8 litres. Blue paint is 3 parts: 3×8=24 litres.", subject: "ratios" },
        { difficulty: "year7", level: "easy", text: "Write the ratio 15:25 in its simplest form.", answer: "3:5", solution: "15 and 25 share a highest common factor of 5. 15÷5=3, 25÷5=5, so 15:25 = 3:5.", subject: "ratios" },
        { difficulty: "year7", level: "easy", text: "A ratio is 4:7. If the first quantity is 20, find the second quantity.", answer: "35", solution: "20 is 4 parts, so 1 part = 5. The second quantity is 7 parts: 7×5=35.", subject: "ratios" },
        { difficulty: "year7", level: "medium", text: "Two numbers are in the ratio 5:8 and their sum is 130. Find the smaller number.", answer: "50", solution: "5+8=13 parts, so 1 part = 130÷13=10. The smaller number is 5 parts: 5×10=50.", subject: "ratios" },
        { difficulty: "year7", level: "medium", text: "A map has a scale of 1:25000. A distance on the map is 6cm. What is the real distance, in kilometres?", answer: "1.5", solution: "Real distance = 6×25000=150000cm = 1500m = 1.5km.", subject: "ratios" },
        { difficulty: "year7", level: "hard", text: "A sum of money is divided in the ratio 3:5:12 and the smallest share is £45. Find the total sum, in pounds.", answer: "300", solution: "£45 is 3 parts, so 1 part = £15. Total is 3+5+12=20 parts: 20×£15=£300.", subject: "ratios" },
        { difficulty: "year7", level: "hard", text: "If a:b = 2:3 and b:c = 4:5, find a:b:c in simplest form.", answer: "8:12:15", solution: "Scale a:b=2:3 to 8:12 and b:c=4:5 to 12:15 so both have b=12. Combined, a:b:c = 8:12:15.", subject: "ratios" },
        { difficulty: "year8", level: "easy", text: "Simplify the ratio 36:48.", answer: "3:4", solution: "36 and 48 share a highest common factor of 12. 36÷12=3, 48÷12=4, so 36:48 = 3:4.", subject: "ratios" },
        { difficulty: "year8", level: "easy", text: "Divide 90 in the ratio 4:5. What is the larger share?", answer: "50", solution: "4+5=9 parts, so 1 part = 90÷9=10. The larger share is 5 parts: 5×10=50.", subject: "ratios" },
        { difficulty: "year8", level: "medium", text: "The ratio of boys to girls in a class is 3:4. There are 28 students in total. How many girls are there?", answer: "16", solution: "3+4=7 parts, so 1 part = 28÷7=4. Girls are 4 parts: 4×4=16.", subject: "ratios" },
        { difficulty: "year8", level: "medium", text: "A photograph measuring 10cm by 15cm is enlarged in the ratio 3:2. What is the new longer side length, in cm?", answer: "22.5", solution: "The longer side (15cm) scales by 3/2: 15×3/2=22.5cm.", subject: "ratios" },
        { difficulty: "year8", level: "hard", text: "Given x:y = 3:4 and y:z = 8:9, find x:y:z in simplest form.", answer: "6:8:9", solution: "Scale x:y=3:4 to 6:8 so y matches y:z=8:9. Combined, x:y:z = 6:8:9.", subject: "ratios" },
        { difficulty: "year8", level: "hard", text: "£360 is shared between A, B and C so that A gets twice as much as B, and B gets three times as much as C. Find C's share, in pounds.", answer: "36", solution: "Let C=x, then B=3x and A=6x. Total: 10x=360, so x=36. C's share is £36.", subject: "ratios" },

        // ---------------------------- PROBABILITY ----------------------------
        { difficulty: "year6", level: "easy", text: "A bag contains 4 red balls and 6 blue balls. What is the probability of picking a red ball, as a fraction in simplest form?", answer: "2/5", solution: "P(red) = 4/10 = 2/5.", subject: "probability" },
        { difficulty: "year6", level: "easy", text: "A fair coin is flipped once. What is the probability of getting heads, as a fraction?", answer: "1/2", solution: "There are 2 equally likely outcomes, 1 of which is heads: P(heads) = 1/2.", subject: "probability" },
        { difficulty: "year6", level: "medium", text: "A die is rolled once. What is the probability of rolling an even number, as a fraction in simplest form?", answer: "1/2", solution: "The even numbers are 2, 4, 6, so P(even) = 3/6 = 1/2.", subject: "probability" },
        { difficulty: "year6", level: "medium", text: "A bag has 3 green, 5 yellow and 2 red counters. What is the probability of NOT picking a red counter, as a fraction?", answer: "4/5", solution: "There are 10 counters, 8 of which are not red: P(not red) = 8/10 = 4/5.", subject: "probability" },
        { difficulty: "year6", level: "hard", text: "Two fair coins are flipped. What is the probability of getting exactly one head, as a fraction?", answer: "1/2", solution: "The outcomes are HH, HT, TH, TT. Exactly one head occurs in 2 of the 4 outcomes: 2/4 = 1/2.", subject: "probability" },
        { difficulty: "year6", level: "hard", text: "A spinner has 8 equal sections numbered 1 to 8. What is the probability of spinning a multiple of 3, as a fraction?", answer: "1/4", solution: "The multiples of 3 from 1-8 are 3 and 6, so P = 2/8 = 1/4.", subject: "probability" },
        { difficulty: "year7", level: "easy", text: "A card is drawn from a standard deck of 52 cards. What is the probability it is a King, as a fraction in simplest form?", answer: "1/13", solution: "There are 4 Kings in 52 cards: P(King) = 4/52 = 1/13.", subject: "probability" },
        { difficulty: "year7", level: "easy", text: "A bag contains 5 red and 15 blue marbles. Find the probability of picking a blue marble, as a decimal.", answer: "0.75", solution: "There are 20 marbles in total, 15 of which are blue: P(blue) = 15/20 = 0.75.", subject: "probability" },
        { difficulty: "year7", level: "medium", text: "A die is rolled twice. What is the probability that both rolls show a 6, as a fraction?", answer: "1/36", solution: "P(6 on one roll) = 1/6, so for two independent rolls: (1/6)×(1/6) = 1/36.", subject: "probability" },
        { difficulty: "year7", level: "medium", text: "In a class of 30 students, 18 study French and the rest study Spanish. A student is chosen at random. What is the probability they study Spanish, as a fraction in simplest form?", answer: "2/5", solution: "12 students study Spanish: P(Spanish) = 12/30 = 2/5.", subject: "probability" },
        { difficulty: "year7", level: "hard", text: "A bag contains 3 red, 4 blue and 5 green balls. Two balls are drawn without replacement. What is the probability both are red, as a fraction?", answer: "1/22", solution: "P = (3/12)×(2/11) = 6/132 = 1/22.", subject: "probability" },
        { difficulty: "year7", level: "hard", text: "The probability it rains tomorrow is 0.3. Assuming each day is independent, what is the probability it does NOT rain on either of the next two days?", answer: "0.49", solution: "P(no rain in one day) = 0.7. For two independent days: 0.7×0.7 = 0.49.", subject: "probability" },
        { difficulty: "year8", level: "easy", text: "A letter is chosen at random from the word MATHS. What is the probability it is a vowel, as a fraction?", answer: "1/5", solution: "MATHS has 5 letters, only 1 of which (A) is a vowel: P(vowel) = 1/5.", subject: "probability" },
        { difficulty: "year8", level: "easy", text: "A fair six-sided die is rolled. What is the probability of NOT rolling a 4, as a fraction?", answer: "5/6", solution: "5 of the 6 faces are not a 4: P(not 4) = 5/6.", subject: "probability" },
        { difficulty: "year8", level: "medium", text: "Two fair dice are rolled and their scores are added. What is the probability the total is 7, as a fraction in simplest form?", answer: "1/6", solution: "There are 36 equally likely outcomes; 6 of them sum to 7: P = 6/36 = 1/6.", subject: "probability" },
        { difficulty: "year8", level: "medium", text: "A box has 4 white and 6 black socks. One sock is drawn and not replaced, then a second is drawn. Find the probability both are white, as a fraction.", answer: "2/15", solution: "P = (4/10)×(3/9) = 12/90 = 2/15.", subject: "probability" },
        { difficulty: "year8", level: "hard", text: "Events A and B are independent. P(A)=0.4 and P(B)=0.5. Find P(A and B).", answer: "0.2", solution: "For independent events, P(A and B) = P(A)×P(B) = 0.4×0.5 = 0.2.", subject: "probability" },
        { difficulty: "year8", level: "hard", text: "A bag contains 5 red and 3 blue balls. Two balls are drawn without replacement. What is the probability that at least one is blue, as a fraction in simplest form?", answer: "9/14", solution: "P(no blue) = (5/8)×(4/7) = 20/56 = 5/14. P(at least one blue) = 1 − 5/14 = 9/14.", subject: "probability" },

        // ---------------------------- PLACE VALUE ----------------------------
        { difficulty: "year6", level: "easy", text: "What is the value of the digit 7 in the number 4,752?", answer: "700", solution: "The 7 is in the hundreds place, so its value is 7×100=700.", subject: "place value" },
        { difficulty: "year6", level: "easy", text: "What is 6,000 + 300 + 20 + 5 written as a single number?", answer: "6325", solution: "Adding the place values: 6000+300+20+5=6325.", subject: "place value" },
        { difficulty: "year6", level: "medium", text: "Round 47,382 to the nearest thousand.", answer: "47000", solution: "The hundreds digit is 3, which rounds down, so 47,382 rounds to 47,000.", subject: "place value" },
        { difficulty: "year6", level: "medium", text: "What is the value of the digit 4 in the number 2.746?", answer: "0.04", solution: "The 4 is in the hundredths place, so its value is 4×0.01=0.04.", subject: "place value" },
        { difficulty: "year6", level: "hard", text: "A number has 3 in the ten-thousands place, 0 in the thousands place, 5 in the hundreds place, 8 in the tens place and 2 in the units place. What is the number?", answer: "30582", solution: "Reading the digits in order gives 30582.", subject: "place value" },
        { difficulty: "year6", level: "hard", text: "Round 6.4952 to 2 decimal places.", answer: "6.50", solution: "The third decimal digit is 5, which rounds up: 6.4952 → 6.50.", subject: "place value" },
        { difficulty: "year7", level: "easy", text: "What is the value of the digit 9 in the number 39,104?", answer: "9000", solution: "The 9 is in the thousands place, so its value is 9×1000=9000.", subject: "place value" },
        { difficulty: "year7", level: "easy", text: "Round 82,650 to the nearest hundred.", answer: "82700", solution: "The tens digit is 5, which rounds up, so 82,650 rounds to 82,700.", subject: "place value" },
        { difficulty: "year7", level: "medium", text: "Write 4.5 × 10^3 as an ordinary number.", answer: "4500", solution: "4.5 × 10^3 = 4.5 × 1000 = 4500.", subject: "place value" },
        { difficulty: "year7", level: "medium", text: "Round 0.03847 to 3 significant figures.", answer: "0.0385", solution: "The first 3 significant figures are 3, 8, 4; the next digit (7) rounds the 4 up to 5: 0.0385.", subject: "place value" },
        { difficulty: "year7", level: "hard", text: "Write 0.000072 in standard form.", answer: "7.2 × 10^-5", solution: "0.000072 = 7.2 ÷ 100000 = 7.2 × 10^-5.", subject: "place value" },
        { difficulty: "year7", level: "hard", text: "Estimate 398 × 51 by rounding each number to 1 significant figure.", answer: "20000", solution: "398 rounds to 400 and 51 rounds to 50: 400×50=20000.", subject: "place value" },
        { difficulty: "year8", level: "easy", text: "What is the value of the digit 6 in the number 6,432,000?", answer: "6000000", solution: "The 6 is in the millions place, so its value is 6×1,000,000=6,000,000.", subject: "place value" },
        { difficulty: "year8", level: "easy", text: "Round 3.14159 to 3 decimal places.", answer: "3.142", solution: "The fourth decimal digit is 5, which rounds the third digit up: 3.14159 → 3.142.", subject: "place value" },
        { difficulty: "year8", level: "medium", text: "Write 3.6 × 10^-2 as an ordinary number.", answer: "0.036", solution: "3.6 × 10^-2 = 3.6 ÷ 100 = 0.036.", subject: "place value" },
        { difficulty: "year8", level: "medium", text: "Round 728,491 to 2 significant figures.", answer: "730000", solution: "The first 2 significant figures are 7, 2; the next digit (8) rounds the 2 up to 3: 730,000.", subject: "place value" },
        { difficulty: "year8", level: "hard", text: "Write 45,600,000 in standard form.", answer: "4.56 × 10^7", solution: "45,600,000 = 4.56 × 10,000,000 = 4.56 × 10^7.", subject: "place value" },
        { difficulty: "year8", level: "hard", text: "Calculate (2.4 × 10^3) × (3 × 10^-2), giving your answer in standard form.", answer: "7.2 × 10^1", solution: "Multiply the coefficients: 2.4×3=7.2. Add the exponents: 3+(-2)=1. Result: 7.2 × 10^1.", subject: "place value" },

        // ----------------------------- GEOMETRY ------------------------------
        { difficulty: "year6", level: "easy", text: "How many degrees are there in a right angle?", answer: "90", solution: "A right angle measures exactly 90 degrees.", subject: "geometry" },
        { difficulty: "year6", level: "easy", text: "What is the name of a 2D shape with 5 sides?", answer: "Pentagon", solution: "A polygon with 5 sides is called a pentagon.", subject: "geometry" },
        { difficulty: "year6", level: "medium", text: "Find the perimeter of a rectangle with length 9cm and width 4cm, in cm.", answer: "26", solution: "Perimeter = 2×(length+width) = 2×(9+4) = 26cm.", subject: "geometry" },
        { difficulty: "year6", level: "medium", text: "How many lines of symmetry does a square have?", answer: "4", solution: "A square has 4 lines of symmetry: 2 through opposite corners and 2 through opposite edge midpoints.", subject: "geometry" },
        { difficulty: "year6", level: "hard", text: "Find the area of a triangle with base 10cm and height 6cm, in cm².", answer: "30", solution: "Area = (base×height)/2 = (10×6)/2 = 30cm².", subject: "geometry" },
        { difficulty: "year6", level: "hard", text: "The angles of a triangle are in the ratio 2:3:4. Find the size of the largest angle, in degrees.", answer: "80", solution: "2+3+4=9 parts, so 1 part = 180÷9=20°. The largest angle is 4 parts: 4×20=80°.", subject: "geometry" },
        { difficulty: "year7", level: "easy", text: "What is the sum of the interior angles of a quadrilateral, in degrees?", answer: "360", solution: "Any quadrilateral's interior angles sum to 360°.", subject: "geometry" },
        { difficulty: "year7", level: "easy", text: "Find the circumference of a circle with radius 7cm. Use π = 22/7. Give your answer in cm.", answer: "44", solution: "Circumference = 2×π×r = 2×(22/7)×7 = 44cm.", subject: "geometry" },
        { difficulty: "year7", level: "medium", text: "A rectangle has area 48cm² and width 6cm. Find its length, in cm.", answer: "8", solution: "Length = area ÷ width = 48 ÷ 6 = 8cm.", subject: "geometry" },
        { difficulty: "year7", level: "medium", text: "Find the size of each exterior angle of a regular hexagon, in degrees.", answer: "60", solution: "Exterior angles of a regular polygon sum to 360°. For a hexagon (6 sides): 360÷6=60°.", subject: "geometry" },
        { difficulty: "year7", level: "hard", text: "Find the area of a circle with radius 14cm. Use π = 22/7. Give your answer in cm².", answer: "616", solution: "Area = π×r² = (22/7)×14² = (22/7)×196 = 616cm².", subject: "geometry" },
        { difficulty: "year7", level: "hard", text: "A right-angled triangle has legs of 9cm and 12cm. Find the length of the hypotenuse, in cm.", answer: "15", solution: "By Pythagoras: hypotenuse² = 9²+12² = 81+144 = 225, so hypotenuse = √225 = 15cm.", subject: "geometry" },
        { difficulty: "year8", level: "easy", text: "What is the name of a polygon with 8 sides?", answer: "Octagon", solution: "A polygon with 8 sides is called an octagon.", subject: "geometry" },
        { difficulty: "year8", level: "easy", text: "Find the volume of a cube with side length 4cm, in cm³.", answer: "64", solution: "Volume = side³ = 4³ = 64cm³.", subject: "geometry" },
        { difficulty: "year8", level: "medium", text: "Find the volume of a cuboid with dimensions 5cm × 4cm × 3cm, in cm³.", answer: "60", solution: "Volume = length×width×height = 5×4×3 = 60cm³.", subject: "geometry" },
        { difficulty: "year8", level: "medium", text: "Two similar rectangles have lengths 6cm and 9cm. If the area of the smaller rectangle is 24cm², find the area of the larger rectangle, in cm².", answer: "54", solution: "The length ratio is 6:9=2:3, so the area ratio is 4:9. Larger area = 24×(9/4) = 54cm².", subject: "geometry" },
        { difficulty: "year8", level: "hard", text: "Find the total surface area of a cube with side length 5cm, in cm².", answer: "150", solution: "Surface area = 6×side² = 6×5² = 6×25 = 150cm².", subject: "geometry" },
        { difficulty: "year8", level: "hard", text: "A cylinder has radius 3cm and height 10cm. Find its volume in terms of π (e.g. 90π).", answer: "90π", solution: "Volume = π×r²×h = π×3²×10 = 90π cm³.", subject: "geometry" },

        // ------------------------------ ALGEBRA -------------------------------
        { difficulty: "year6", level: "easy", text: "If x + 5 = 12, what is x?", answer: "7", solution: "Subtract 5 from both sides: x = 12−5 = 7.", subject: "algebra" },
        { difficulty: "year6", level: "easy", text: "What is 3n when n = 4?", answer: "12", solution: "3n = 3×4 = 12.", subject: "algebra" },
        { difficulty: "year6", level: "medium", text: "Solve: 2x + 3 = 11", answer: "4", solution: "Subtract 3: 2x=8. Divide by 2: x=4.", subject: "algebra" },
        { difficulty: "year6", level: "medium", text: "If y − 6 = 15, find y.", answer: "21", solution: "Add 6 to both sides: y = 15+6 = 21.", subject: "algebra" },
        { difficulty: "year6", level: "hard", text: "Solve: 3(x + 2) = 21", answer: "5", solution: "Divide by 3: x+2=7. Subtract 2: x=5.", subject: "algebra" },
        { difficulty: "year6", level: "hard", text: "The perimeter of a square is (4x) cm. If the perimeter is 36cm, find x.", answer: "9", solution: "4x=36, so x=36÷4=9.", subject: "algebra" },
        { difficulty: "year7", level: "easy", text: "Simplify: 3a + 5a", answer: "8a", solution: "3a+5a = (3+5)a = 8a.", subject: "algebra" },
        { difficulty: "year7", level: "easy", text: "Solve: x/4 = 6", answer: "24", solution: "Multiply both sides by 4: x = 6×4 = 24.", subject: "algebra" },
        { difficulty: "year7", level: "medium", text: "Solve: 5x − 4 = 2x + 11", answer: "5", solution: "Subtract 2x: 3x−4=11. Add 4: 3x=15. Divide by 3: x=5.", subject: "algebra" },
        { difficulty: "year7", level: "medium", text: "Expand: 3(2x − 5)", answer: "6x - 15", solution: "3×2x=6x and 3×(-5)=-15, giving 6x−15.", subject: "algebra" },
        { difficulty: "year7", level: "hard", text: "Solve the simultaneous equations x + y = 10 and x − y = 4. Find x.", answer: "7", solution: "Adding the equations: 2x=14, so x=7.", subject: "algebra" },
        { difficulty: "year7", level: "hard", text: "Factorise: x^2 + 7x + 12", answer: "(x + 3)(x + 4)", solution: "Two numbers that multiply to 12 and add to 7 are 3 and 4, giving (x+3)(x+4).", subject: "algebra" },
        { difficulty: "year8", level: "easy", text: "Simplify: 4x + 3y − x + 2y", answer: "3x + 5y", solution: "Combine x terms: 4x−x=3x. Combine y terms: 3y+2y=5y. Result: 3x+5y.", subject: "algebra" },
        { difficulty: "year8", level: "easy", text: "Solve: 2x + 7 = 19", answer: "6", solution: "Subtract 7: 2x=12. Divide by 2: x=6.", subject: "algebra" },
        { difficulty: "year8", level: "medium", text: "Solve: (2x − 1)/3 = 5", answer: "8", solution: "Multiply by 3: 2x−1=15. Add 1: 2x=16. Divide by 2: x=8.", subject: "algebra" },
        { difficulty: "year8", level: "medium", text: "Factorise: x^2 − 9", answer: "(x - 3)(x + 3)", solution: "This is a difference of two squares: x²−9 = (x-3)(x+3).", subject: "algebra" },
        { difficulty: "year8", level: "hard", text: "Solve: x^2 − 5x + 6 = 0. Give the smaller solution.", answer: "2", solution: "Factorising: (x−2)(x−3)=0, so x=2 or x=3. The smaller solution is 2.", subject: "algebra" },
        { difficulty: "year8", level: "hard", text: "Solve the simultaneous equations 2x + y = 11 and x − y = 1. Find x.", answer: "4", solution: "Adding the equations: 3x=12, so x=4.", subject: "algebra" },

        // --------------------------- PROBLEM SOLVING ---------------------------
        { difficulty: "year6", level: "easy", text: "Tom has 24 sweets. He shares them equally among 4 friends. How many sweets does each friend get?", answer: "6", solution: "24÷4=6 sweets each.", subject: "problem solving" },
        { difficulty: "year6", level: "easy", text: "A book costs £8. How much do 5 books cost, in pounds?", answer: "40", solution: "5×£8=£40.", subject: "problem solving" },
        { difficulty: "year6", level: "medium", text: "A school has 320 pupils. If 3/8 of them are boys, how many boys are there?", answer: "120", solution: "3/8 of 320 = (320÷8)×3 = 40×3 = 120.", subject: "problem solving" },
        { difficulty: "year6", level: "medium", text: "A train leaves at 09:45 and arrives at 11:20. How long, in minutes, is the journey?", answer: "95", solution: "From 09:45 to 11:20 is 1 hour 35 minutes, which is 60+35=95 minutes.", subject: "problem solving" },
        { difficulty: "year6", level: "hard", text: "Sam buys 3 pens at 45p each and 2 notebooks at £1.20 each. How much change does he get from £5? Give your answer in pounds (e.g. 1.25).", answer: "1.25", solution: "Pens: 3×45p=£1.35. Notebooks: 2×£1.20=£2.40. Total: £3.75. Change from £5: £5−£3.75=£1.25.", subject: "problem solving" },
        { difficulty: "year6", level: "hard", text: "A tank holds 180 litres when full. It is currently 2/3 full. How many more litres are needed to fill it?", answer: "60", solution: "Currently: 2/3×180=120 litres. Needed: 180−120=60 litres.", subject: "problem solving" },
        { difficulty: "year7", level: "easy", text: "A recipe for 4 people needs 200g of rice. How much rice is needed for 10 people, in grams?", answer: "500", solution: "Rice per person: 200÷4=50g. For 10 people: 50×10=500g.", subject: "problem solving" },
        { difficulty: "year7", level: "easy", text: "Jack runs 400m in 80 seconds. What is his speed, in metres per second?", answer: "5", solution: "Speed = distance÷time = 400÷80 = 5 m/s.", subject: "problem solving" },
        { difficulty: "year7", level: "medium", text: "A shop reduces a £45 jacket by 20% in a sale. What is the sale price, in pounds?", answer: "36", solution: "20% of £45 = £9. Sale price: £45−£9=£36.", subject: "problem solving" },
        { difficulty: "year7", level: "medium", text: "Tap A alone fills a tank in 12 hours. If tap A works alone for 4 hours, what fraction of the tank is filled?", answer: "1/3", solution: "In 1 hour, tap A fills 1/12 of the tank. In 4 hours: 4×(1/12)=4/12=1/3.", subject: "problem solving" },
        { difficulty: "year7", level: "hard", text: "A car travels 210km in 3 hours, then 150km in 2 hours. Find its average speed for the whole journey, in km/h.", answer: "72", solution: "Total distance: 210+150=360km. Total time: 3+2=5h. Average speed: 360÷5=72km/h.", subject: "problem solving" },
        { difficulty: "year7", level: "hard", text: "A photo printing shop charges a £3 set-up fee plus 25p per photo. How many photos can be printed for £13?", answer: "40", solution: "Money left after set-up fee: £13−£3=£10=1000p. Photos: 1000÷25=40.", subject: "problem solving" },
        { difficulty: "year8", level: "easy", text: "A number increased by 15% is 92. What was the original number?", answer: "80", solution: "Let the number be x. 1.15x=92, so x=92÷1.15=80.", subject: "problem solving" },
        { difficulty: "year8", level: "easy", text: "A cyclist travels at 18km/h for 2.5 hours. How far does she travel, in km?", answer: "45", solution: "Distance = speed×time = 18×2.5 = 45km.", subject: "problem solving" },
        { difficulty: "year8", level: "medium", text: "Two numbers have a sum of 45 and a difference of 9. Find the larger number.", answer: "27", solution: "Larger number = (sum+difference)÷2 = (45+9)÷2 = 27.", subject: "problem solving" },
        { difficulty: "year8", level: "medium", text: "A shop buys a jacket for £40 and sells it for £56. What is the percentage profit?", answer: "40", solution: "Profit: £56−£40=£16. Percentage profit: (16÷40)×100=40%.", subject: "problem solving" },
        { difficulty: "year8", level: "hard", text: "A rectangular garden is 3m longer than it is wide. Its area is 70m². Find its width, in metres.", answer: "7", solution: "Let width=w. w(w+3)=70, so w²+3w−70=0, which factorises to (w−7)(w+10)=0. Since width is positive, w=7.", subject: "problem solving" },
        { difficulty: "year8", level: "hard", text: "£2000 is invested at 5% compound interest per year. Find the value after 3 years, to the nearest pound.", answer: "2315", solution: "Value = 2000×1.05³ = 2000×1.157625 = 2315.25, which rounds to £2315.", subject: "problem solving" },
      ];

      for (const q of topicPackQuestions) {
        await pool.query(
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source, subject, level)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [q.difficulty, 'shortAnswer', q.text, q.answer, null, q.solution, 'Topic Coverage Pack', q.subject, q.level]
        );
      }
      console.log(`Seeded ${topicPackQuestions.length} topic-coverage questions (ratios, probability, place value, geometry, algebra, problem solving)`);
    }

    // Seed the "Lucky Dip Word Problems" worksheet (CGP), idempotent — 12
    // multi-step Year 6 word problems supplied by a parent.
    const luckyDipCheck = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE source = 'Lucky Dip Word Problems (CGP)'"
    );
    if (parseInt(luckyDipCheck.rows[0].count) === 0) {
      const luckyDipQuestions = [
        { level: "medium", text: "Joseph has 189 toy cars in his collection. He gives 25 cars to his friend, and receives 12 more as birthday presents. How many does he have now?", answer: "176", solution: "189 − 25 = 164. Then 164 + 12 = 176." },
        { level: "medium", text: "Lucy has saved up £1023 from birthday and Christmas money to buy her first car. She spends £900 on the car and needs £225 to pay for car insurance. How much more money does she need to save?", answer: "102", solution: "Money left after buying the car: £1023 − £900 = £123. She still needs £225 for insurance, so she needs £225 − £123 = £102 more." },
        { level: "medium", text: "There are 766 pupils in a school. There are two Year 4 classes, which both have 28 pupils. How many pupils at school aren't in Year 4?", answer: "710", solution: "Year 4 pupils: 28 × 2 = 56. Pupils not in Year 4: 766 − 56 = 710." },
        { level: "medium", text: "Captain Smyth is a pilot and he has flown 240 miles each day for the last six days. He is only allowed to fly 1,600 miles per week. How far can he fly on the last day?", answer: "160", solution: "Miles flown in 6 days: 240 × 6 = 1440. Miles left for the week: 1600 − 1440 = 160." },
        { level: "hard", text: "There are 1024 tickets for a concert. Half of the tickets have been reserved online and 364 tickets have been bought at the box office. How many tickets are still available?", answer: "148", solution: "Reserved online: 1024 ÷ 2 = 512. Total sold: 512 + 364 = 876. Available: 1024 − 876 = 148." },
        { level: "hard", text: "Toni starts work at 9:00am in a hair salon. She has 10 appointments booked before lunch. Each appointment lasts 20 minutes. What is the earliest time that she can have lunch?", answer: "12:20pm", solution: "Total appointment time: 10 × 20 = 200 minutes = 3 hours 20 minutes. Starting at 9:00am, lunch can begin at 12:20pm." },
        { level: "easy", text: "In an orchestra there are 45 cellos. Each cello has four strings. Two of the cello players break a string. How many strings are left?", answer: "178", solution: "Total strings: 45 × 4 = 180. After 2 break: 180 − 2 = 178." },
        { level: "medium", text: "In Year 6 there are three classes. One has 25 pupils and the other two have 26 pupils. Five Year 6 pupils are off sick today. How many Year 6 pupils are in school today?", answer: "72", solution: "Total Year 6 pupils: 25 + 26 + 26 = 77. In school today: 77 − 5 = 72." },
        { level: "medium", text: "Lui has £1560 in his bank account. He spends half of that money on a holiday to New York. He spends another £120 on his electricity bill. How much does he have left?", answer: "660", solution: "Spent on holiday: £1560 ÷ 2 = £780, leaving £780. After the electricity bill: £780 − £120 = £660." },
        { level: "hard", text: "Billie starts her shift at the hospital at 11:00am. She gets 40 minutes for lunch and her shift finishes at 5:00pm. If each procedure lasts for 40 minutes, how many could she fit in during her shift?", answer: "8", solution: "Shift length: 11:00am to 5:00pm = 6 hours = 360 minutes. Working time: 360 − 40 = 320 minutes. Procedures: 320 ÷ 40 = 8." },
        { level: "hard", text: "Max has 1320 toy soldiers. He gives one third of these to his brother and then another 150 to his cousin. How many does he have left?", answer: "730", solution: "Given to brother: 1320 ÷ 3 = 440, leaving 1320 − 440 = 880. After giving 150 to his cousin: 880 − 150 = 730." },
        { level: "hard", text: "Frankie has eight stops on his bus route. On the first four rounds he picks someone up at every stop, and on the fifth round he only picks up passengers at five of the stops. How many stops does he pick people up at?", answer: "37", solution: "First four rounds: 4 × 8 = 32 pickups. Fifth round: 5 more. Total: 32 + 5 = 37." },
      ];

      for (const q of luckyDipQuestions) {
        await pool.query(
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source, subject, level)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          ['year6', 'shortAnswer', q.text, q.answer, null, q.solution, 'Lucky Dip Word Problems (CGP)', 'problem solving', q.level]
        );
      }
      console.log(`Seeded ${luckyDipQuestions.length} Lucky Dip Word Problems into Year 6`);
    }

    // Seed the "Percentage Word Problems 6.2A" worksheet (Math Salamanders),
    // idempotent — 6 Year 6 percentage word problems supplied by a parent.
    const percentPackCheck = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE source = 'Percentage Word Problems 6.2A'"
    );
    if (parseInt(percentPackCheck.rows[0].count) === 0) {
      const percentPackQuestions = [
        { level: "medium", text: "A pie shop sells 32 apple pies, 33 pumpkin pies, 20 cherry pies, and 15 chocolate pies. What percentage of pies sold were apple or cherry?", answer: "52", solution: "Total pies: 32+33+20+15=100. Apple or cherry: 32+20=52. Percentage: 52/100=52%." },
        { level: "medium", text: "Newton watches a movie with his friends. They watch 50% of the movie and then take a break. They then watch the remaining 65 minutes. How long was the movie, in minutes?", answer: "130", solution: "The remaining 65 minutes is the other 50% of the movie, so the whole movie is 65×2=130 minutes." },
        { level: "hard", text: "Captain's Autos sells 22 used cars on Monday, and 18 cars on Tuesday. This was 25% of the number of sales for the week. How many cars did they sell altogether that week?", answer: "160", solution: "Monday and Tuesday sales: 22+18=40, which is 25% of the week. Whole week: 40÷0.25=160 cars." },
        { level: "hard", text: "Sally spends 15% of her weekly budget on food, and 35% on rent. She has £350 left over. How much was her budget, in pounds?", answer: "700", solution: "Food and rent together: 15%+35%=50%, so the remaining 50% is £350. Whole budget: 350÷0.5=£700." },
        { level: "medium", text: "There are 30 Year 6 students and 40 Year 7 students in a group. 10% of the Year 6 students and 25% of the Year 7 students are vegan. How many vegans are in the group altogether?", answer: "13", solution: "Year 6 vegans: 10% of 30=3. Year 7 vegans: 25% of 40=10. Total: 3+10=13." },
        { level: "easy", text: "Tyger and Newton have a long jump competition. Tyger jumps 20% further than Newton. If Newton jumps 400cm, how far does Tyger jump, in cm?", answer: "480", solution: "Tyger's jump: 400 × 1.2 = 480cm." },
      ];

      for (const q of percentPackQuestions) {
        await pool.query(
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source, subject, level)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          ['year6', 'shortAnswer', q.text, q.answer, null, q.solution, 'Percentage Word Problems 6.2A', 'problem solving', q.level]
        );
      }
      console.log(`Seeded ${percentPackQuestions.length} Percentage Word Problems into Year 6`);
    }

    // Link questions to a Learn-tab topic (src/topics.js), so a child who gets
    // most of a topic's questions wrong can be pointed straight at the lesson.
    // Matched by exact question text rather than gated behind the "already
    // seeded" checks above, so it also backfills topic_id on databases that
    // were seeded before this column existed.
    const topicPackByTopic = {
      ratios: 'ratios',
      probability: 'probability',
      'place value': 'place-value',
    };
    for (const [subject, topicId] of Object.entries(topicPackByTopic)) {
      await pool.query(
        `UPDATE questions SET topic_id = $1 WHERE source = 'Topic Coverage Pack' AND subject = $2 AND topic_id IS NULL`,
        [topicId, subject]
      );
    }
    await pool.query(
      `UPDATE questions SET topic_id = 'percentages' WHERE source = 'Percentage Word Problems 6.2A' AND topic_id IS NULL`
    );

    // The remaining packs mix several Learn topics under one subject tag, so
    // they're linked individually by exact question text.
    const topicByText = [
      // Year Tier Practice Bank
      ['What is 10% of 50?', 'percentages'],
      ['What is 20% of 40?', 'percentages'],
      ['What is 25% of 80?', 'percentages'],
      ['What is 50% of 60?', 'percentages'],
      ['What is 10% of 90?', 'percentages'],
      ['A rectangle has length 9cm and width 5cm. What is its perimeter?', 'area-perimeter'],
      ['A rectangle has area 42 cm² and length 7 cm. What is its width?', 'area-perimeter'],
      ['A class has 12 boys and 18 girls. What fraction of the class are boys?', 'fractions-decimals'],
      ['Find the missing number: 4, 8, 16, 32, ?', 'number-sequences'],
      ['What is the perimeter of a square with area 49 cm²?', 'area-perimeter'],
      ['A recipe needs 250g of flour to make 10 cakes. How much flour is needed for 25 cakes?', 'ratios'],
      ['The sum of two numbers is 45 and their difference is 9. What is the larger number?', 'solving-linear-equations'],
      ["A tank is 2/5 full of water. After adding 30 litres, it becomes 4/5 full. What is the tank's total capacity, in litres?", 'fractions-decimals'],
      ['In a class of 40 students, 60% passed a test on the first try. Of those who failed, half passed on a retake. How many students still had not passed after the retake?', 'percentages'],
      ['A rectangular garden is 3 times as long as it is wide. Its perimeter is 64 m. What is the width, in metres?', 'area-perimeter'],
      ['Three friends share £120 in the ratio 2:3:5. How much does the friend with the largest share receive?', 'ratios'],
      ['A number is increased by 20% and then decreased by 20%. If the final result is 96, what was the original number?', 'percentages'],
      ['The average of 5 numbers is 18. If one more number is added, the new average becomes 20. What was the number added?', 'averages'],
      ['A shop reduces a £80 jacket by 25% in a sale, then reduces the sale price by a further 10%. What is the final price, in pounds?', 'percentages'],
      ['Solve for x: 4x + 7 = 27', 'solving-linear-equations'],
      ['Solve for x: 3x − 8 = 13', 'solving-linear-equations'],
      ['What is -7 + 12?', 'negative-numbers'],
      ['What is -3 × -6?', 'negative-numbers'],
      ['What is 30% of 150?', 'percentages'],
      ['Simplify: 5x + 3x − 2x', 'simplifying-expressions'],
      ['A triangle has angles of 55° and 65°. What is the third angle?', 'angle-rules'],
      ['Solve for x: 2(x + 5) = 22', 'solving-linear-equations'],
      ['Expand: 4(2x − 3)', 'expanding-brackets'],
      ['A right-angled triangle has legs 9cm and 12cm. What is the length of its hypotenuse?', 'pythagoras-theorem'],
      ['What is the HCF (highest common factor) of 48 and 60?', 'hcf-lcm'],
      ['What is the LCM (lowest common multiple) of 8 and 12?', 'hcf-lcm'],
      ['A bag has 4 red, 3 blue and 5 green balls. What is the probability of picking a blue ball at random?', 'probability'],
      ['Simplify: (3x²) × (4x³)', 'simplifying-expressions'],
      ['Solve for x: 5x − 3 = 3x + 11', 'solving-linear-equations'],
      ['Factorise: x² + 7x + 10', 'algebra-basics'],
      ['The angles of a triangle are in the ratio 2:3:4. What is the size of the largest angle?', 'angle-rules'],
      ['A number x satisfies 3(x-2) = 2(x+5). Find x.', 'solving-linear-equations'],
      ['Two numbers have HCF 6 and LCM 90. If one number is 18, what is the other?', 'hcf-lcm'],
      ["A shape's perimeter is 60cm. Its length is twice its width plus 3cm. Find the width, in cm.", 'area-perimeter'],
      ['The mean of 4 numbers is 15. Three of the numbers are 10, 14 and 18. What is the fourth number?', 'averages'],
      ['Solve for x: 6x - 9 = 21', 'solving-linear-equations'],
      ['Expand: 5(3x + 2)', 'expanding-brackets'],
      ['Simplify: 7y - 2y + 5y', 'simplifying-expressions'],
      ['What is the area of a triangle with base 10cm and height 6cm?', 'area-perimeter'],
      ['What is 60% of 90?', 'percentages'],
      ['Find the median of: 3, 7, 9, 12, 15', 'averages'],
      ['Solve: 3(x - 4) = 2(x + 1)', 'solving-linear-equations'],
      ['Factorise: x² - 9', 'algebra-basics'],
      ['A right-angled triangle has hypotenuse 25cm and one leg 7cm. What is the length of the other leg, in cm?', 'pythagoras-theorem'],
      ['The mean of 6 numbers is 12. Find the sum of the 6 numbers.', 'averages'],
      ['Simplify: (2x³) × (5x²)', 'simplifying-expressions'],
      ['A cylinder has radius 4cm and height 10cm. Find its volume in terms of π.', '3d-shapes'],
      ['What is the interior angle of a regular decagon (10 sides)?', '2d-shapes'],
      ['Solve the simultaneous equations: x+y=10 and x−y=4. Find x.', 'solving-linear-equations'],
      ['Solve: x² − 5x + 6 = 0. Give the larger solution.', 'algebra-basics'],
      ['Expand and simplify: (x + 3)(x - 5)', 'algebra-basics'],
      ['A ladder 17m long leans against a wall with its foot 8m from the wall. How high up the wall does it reach, in metres?', 'pythagoras-theorem'],
      ['Solve for x: (x/3) + (x/4) = 7', 'solving-linear-equations'],
      ['A car depreciates by 15% each year. If it costs £20,000 new, what is its value after 2 years, to the nearest pound?', 'percentages'],
      ['The perimeter of a rectangle is 50cm and its area is 150cm². What is the length of the longer side, in cm?', 'area-perimeter'],
      ['Two similar triangles have corresponding sides in ratio 2:5. If the area of the smaller triangle is 12cm², what is the area of the larger triangle?', 'area-perimeter'],
      // Topic Coverage Pack — geometry
      ['How many degrees are there in a right angle?', 'angle-rules'],
      ['What is the name of a 2D shape with 5 sides?', '2d-shapes'],
      ['Find the perimeter of a rectangle with length 9cm and width 4cm, in cm.', 'area-perimeter'],
      ['How many lines of symmetry does a square have?', '2d-shapes'],
      ['Find the area of a triangle with base 10cm and height 6cm, in cm².', 'area-perimeter'],
      ['The angles of a triangle are in the ratio 2:3:4. Find the size of the largest angle, in degrees.', 'angle-rules'],
      ['What is the sum of the interior angles of a quadrilateral, in degrees?', '2d-shapes'],
      ['Find the circumference of a circle with radius 7cm. Use π = 22/7. Give your answer in cm.', '2d-shapes'],
      ['A rectangle has area 48cm² and width 6cm. Find its length, in cm.', 'area-perimeter'],
      ['Find the size of each exterior angle of a regular hexagon, in degrees.', '2d-shapes'],
      ['Find the area of a circle with radius 14cm. Use π = 22/7. Give your answer in cm².', 'area-perimeter'],
      ['A right-angled triangle has legs of 9cm and 12cm. Find the length of the hypotenuse, in cm.', 'pythagoras-theorem'],
      ['What is the name of a polygon with 8 sides?', '2d-shapes'],
      ['Find the volume of a cube with side length 4cm, in cm³.', '3d-shapes'],
      ['Find the volume of a cuboid with dimensions 5cm × 4cm × 3cm, in cm³.', '3d-shapes'],
      ['Two similar rectangles have lengths 6cm and 9cm. If the area of the smaller rectangle is 24cm², find the area of the larger rectangle, in cm².', 'area-perimeter'],
      ['Find the total surface area of a cube with side length 5cm, in cm².', '3d-shapes'],
      ['A cylinder has radius 3cm and height 10cm. Find its volume in terms of π (e.g. 90π).', '3d-shapes'],
      // Topic Coverage Pack — algebra
      ['If x + 5 = 12, what is x?', 'solving-linear-equations'],
      ['What is 3n when n = 4?', 'substitution'],
      ['Solve: 2x + 3 = 11', 'solving-linear-equations'],
      ['If y − 6 = 15, find y.', 'solving-linear-equations'],
      ['Solve: 3(x + 2) = 21', 'solving-linear-equations'],
      ['The perimeter of a square is (4x) cm. If the perimeter is 36cm, find x.', 'solving-linear-equations'],
      ['Simplify: 3a + 5a', 'simplifying-expressions'],
      ['Solve: x/4 = 6', 'solving-linear-equations'],
      ['Solve: 5x − 4 = 2x + 11', 'solving-linear-equations'],
      ['Expand: 3(2x − 5)', 'expanding-brackets'],
      ['Solve the simultaneous equations x + y = 10 and x − y = 4. Find x.', 'solving-linear-equations'],
      ['Factorise: x^2 + 7x + 12', 'algebra-basics'],
      ['Simplify: 4x + 3y − x + 2y', 'simplifying-expressions'],
      ['Solve: 2x + 7 = 19', 'solving-linear-equations'],
      ['Solve: (2x − 1)/3 = 5', 'solving-linear-equations'],
      ['Factorise: x^2 − 9', 'algebra-basics'],
      ['Solve: x^2 − 5x + 6 = 0. Give the smaller solution.', 'algebra-basics'],
      ['Solve the simultaneous equations 2x + y = 11 and x − y = 1. Find x.', 'solving-linear-equations'],
      // Topic Coverage Pack — problem solving (only where a single topic clearly fits)
      ['A school has 320 pupils. If 3/8 of them are boys, how many boys are there?', 'fractions-decimals'],
      ['A tank holds 180 litres when full. It is currently 2/3 full. How many more litres are needed to fill it?', 'fractions-decimals'],
      ['A recipe for 4 people needs 200g of rice. How much rice is needed for 10 people, in grams?', 'ratios'],
      ['A shop reduces a £45 jacket by 20% in a sale. What is the sale price, in pounds?', 'percentages'],
      ['Tap A alone fills a tank in 12 hours. If tap A works alone for 4 hours, what fraction of the tank is filled?', 'fractions-decimals'],
      ['A number increased by 15% is 92. What was the original number?', 'percentages'],
      ['Two numbers have a sum of 45 and a difference of 9. Find the larger number.', 'solving-linear-equations'],
      ['A shop buys a jacket for £40 and sells it for £56. What is the percentage profit?', 'percentages'],
      ['A rectangular garden is 3m longer than it is wide. Its area is 70m². Find its width, in metres.', 'algebra-basics'],
      ['£2000 is invested at 5% compound interest per year. Find the value after 3 years, to the nearest pound.', 'percentages'],
      // Lucky Dip Word Problems
      ['There are 1024 tickets for a concert. Half of the tickets have been reserved online and 364 tickets have been bought at the box office. How many tickets are still available?', 'fractions-decimals'],
      ['Lui has £1560 in his bank account. He spends half of that money on a holiday to New York. He spends another £120 on his electricity bill. How much does he have left?', 'fractions-decimals'],
      ['Max has 1320 toy soldiers. He gives one third of these to his brother and then another 150 to his cousin. How many does he have left?', 'fractions-decimals'],
    ];
    for (const [text, topicId] of topicByText) {
      await pool.query(
        `UPDATE questions SET topic_id = $1 WHERE text = $2 AND topic_id IS NULL`,
        [topicId, text]
      );
    }

    // Best-effort topic links for the older question bank (PMC/JMC/Olympiad/
    // Kangaroo and other pre-existing questions), matched by keyword. Ordered
    // most-specific-first; each rule only touches rows still unlinked, so
    // earlier (more confident) matches always win. Anything left unmatched
    // stays without a topic link rather than risk a misleading suggestion.
    // Patterns are full ILIKE patterns (wildcards already included) so a
    // literal '%' can be escaped correctly — '%' is a wildcard in LIKE/ILIKE,
    // so matching a literal percent sign needs '\%', not a bare '%'.
    const keywordRules = [
      [['%pythagor%', '%hypotenuse%'], 'pythagoras-theorem'],
      [['%highest common factor%', '%hcf%', '%lowest common multiple%', '%lcm%'], 'hcf-lcm'],
      [['%prime number%', '%is prime%', '%prime factor%'], 'prime-numbers'],
      [['%coordinate%', '%co-ordinate%', '%midpoint%'], 'coordinates'],
      [['%percent%', '%\\%%'], 'percentages'],
      [['%standard form%'], 'place-value'],
      // 'vertices'/'vertex' deliberately excluded — also used for 2D polygons
      // and coordinate-geometry points, not just 3D solids.
      [['%volume%', '%cuboid%', '%cylinder%', '%sphere%', '%cone %', '%surface area%'], '3d-shapes'],
      [['%circumference%', '%perimeter%', '%area%'], 'area-perimeter'],
      [['%ratio%'], 'ratios'],
      [['%probability%'], 'probability'],
      [['%mean of%', '%median%', '% mode %', '%average of%'], 'averages'],
      [['%sequence%', '%next term%', '%missing number%'], 'number-sequences'],
      [['%factorise%'], 'algebra-basics'],
      [['%simplify:%'], 'simplifying-expressions'],
      [['%expand:%'], 'expanding-brackets'],
      // "simultaneous equation(s)", not e.g. "simultaneous matches" in a
      // scheduling puzzle.
      [['%simultaneous equation%'], 'solving-linear-equations'],
      [['%solve:%', '%solve for%'], 'solving-linear-equations'],
    ];
    for (const [patterns, topicId] of keywordRules) {
      const conditions = patterns.map((_, i) => `text ILIKE $${i + 2}`).join(' OR ');
      await pool.query(
        `UPDATE questions SET topic_id = $1 WHERE topic_id IS NULL AND (${conditions})`,
        [topicId, ...patterns]
      );
    }
    // 'angle'/'angles' as a whole word only — a plain substring match would
    // also hit "triangle", "rectangle", "quadrangle" etc.
    await pool.query(
      `UPDATE questions SET topic_id = 'angle-rules' WHERE topic_id IS NULL AND text ~* '\\mangles?\\M'`
    );
    // Remaining untagged geometry/algebra questions get a general topic.
    await pool.query(`UPDATE questions SET topic_id = '2d-shapes' WHERE topic_id IS NULL AND subject = 'geometry'`);
    await pool.query(`UPDATE questions SET topic_id = 'algebra-basics' WHERE topic_id IS NULL AND subject = 'algebra'`);

    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Records a badge as earned (no-op if already earned) and, the first time,
// pays out its one-time coin bonus. Returns the badge catalog entry if this
// call newly awarded it, or null if the user already had it.
async function awardBadge(userId, badgeId) {
  const badge = BADGE_MAP[badgeId];
  if (!badge) return null;
  const inserted = await pool.query(
    `INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)
     ON CONFLICT (user_id, badge_id) DO NOTHING
     RETURNING id`,
    [userId, badgeId]
  );
  if (inserted.rows.length === 0) return null;
  await pool.query(
    `UPDATE user_progress SET total_coins = total_coins + $2, updated_at = NOW() WHERE user_id = $1`,
    [userId, badge.coins]
  );
  // Log the bonus into today's daily history too, so per-day coin totals
  // (used by the daily activity dashboard) include badge bonuses, not just
  // per-answer rewards.
  const today = new Date().toISOString().split('T')[0];
  await pool.query(
    `INSERT INTO daily_history (user_id, date, problems_solved, coins_earned)
     VALUES ($1, $2, 0, $3)
     ON CONFLICT (user_id, date) DO UPDATE SET coins_earned = daily_history.coins_earned + $3`,
    [userId, today, badge.coins]
  );
  return badge;
}

// Awards the combo badge once every one of its prerequisite badges has been earned.
async function checkComboBadge(userId, comboId, prerequisiteIds) {
  const earned = await pool.query(
    `SELECT badge_id FROM user_badges WHERE user_id = $1 AND badge_id = ANY($2::text[])`,
    [userId, prerequisiteIds]
  );
  if (earned.rows.length < prerequisiteIds.length) return null;
  return awardBadge(userId, comboId);
}

// Authentication endpoints
app.post('/api/auth/register', async (req, res) => {
  const { username, password, name, type } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password, name, type) VALUES ($1, $2, $3, $4) RETURNING id, username, name, type',
      [username, password, name, type]
    );

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

    // Auto-create progress row for accounts added directly to the DB
    await pool.query(
      'INSERT INTO user_progress (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [user.id]
    );

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
// exclude (optional): comma-separated question ids already served earlier in
// the current paper, so a 15-question paper doesn't repeat the same question
// twice while its tier's pool still has unused questions left.
app.get('/api/questions/:difficulty', async (req, res) => {
  const { difficulty } = req.params;
  const { level, exclude } = req.query;
  const excludeIds = (exclude || '')
    .split(',')
    .map(s => parseInt(s, 10))
    .filter(Number.isFinite);
  try {
    if (level) {
      const tiered = await pool.query(
        'SELECT * FROM questions WHERE difficulty = $1 AND level = $2 AND NOT (id = ANY($3::int[])) ORDER BY RANDOM() LIMIT 1',
        [difficulty, level, excludeIds]
      );
      if (tiered.rows[0]) {
        return res.json(tiered.rows[0]);
      }
      // Every question in this tier has already been served this paper —
      // start reusing them rather than dead-ending the child's session.
      const tieredAny = await pool.query(
        'SELECT * FROM questions WHERE difficulty = $1 AND level = $2 ORDER BY RANDOM() LIMIT 1',
        [difficulty, level]
      );
      if (tieredAny.rows[0]) {
        return res.json(tieredAny.rows[0]);
      }
      // No questions tagged with this tier yet — fall back to any question
      // at this difficulty rather than dead-ending the child's session.
    }
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
// outcome: 'correct' | 'incorrect' | 'skipped'. Coin amounts come from the
// configurable coin_settings row so parents can tune the economy. Correct
// answers are rewarded according to the question's difficulty tier
// (question_level: 'easy' | 'medium' | 'hard'), defaulting to the medium
// rate for untagged (legacy) questions.
app.post('/api/progress/update', async (req, res) => {
  const { user_id, outcome, difficulty, question_text, question_level, question_id } = req.body;
  try {
    const settingsResult = await pool.query('SELECT * FROM coin_settings WHERE id = 1');
    const settings = settingsResult.rows[0];

    const correctReward =
      question_level === 'easy' ? settings.easy_coins :
      question_level === 'hard' ? settings.hard_coins :
      settings.medium_coins;
    const nominalDelta =
      outcome === 'correct' ? correctReward :
      outcome === 'incorrect' ? -settings.wrong_coins :
      outcome === 'skipped' ? -settings.skip_coins : 0;
    const correctIncrement = outcome === 'correct' ? 1 : 0;

    const current = await pool.query('SELECT total_coins FROM user_progress WHERE user_id = $1', [user_id]);
    const currentTotal = current.rows[0]?.total_coins || 0;
    // Coins never go below zero — clamp here and log the actual (possibly
    // smaller) change that resulted, so history stays consistent.
    const newTotal = Math.max(0, currentTotal + nominalDelta);
    const actualDelta = newTotal - currentTotal;

    // Per-tier consecutive-correct counter, used for streak badges. A wrong
    // or skipped answer at a tier resets only that tier's streak.
    const tier = ['easy', 'medium', 'hard'].includes(question_level) ? question_level : null;
    const streakColumn = tier ? `streak_${tier}` : null;
    const streakSql = streakColumn
      ? `${streakColumn} = ${outcome === 'correct' ? `${streakColumn} + 1` : '0'},`
      : '';
    const overallStreakSql = outcome === 'correct'
      ? `current_streak = current_streak + 1, max_streak = GREATEST(max_streak, current_streak + 1),`
      : `current_streak = 0,`;

    const progress = await pool.query(
      `UPDATE user_progress
       SET questions_solved = questions_solved + 1,
           correct_answers = correct_answers + $2,
           total_coins = $3,
           ${streakSql}
           ${overallStreakSql}
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [user_id, correctIncrement, newTotal]
    );

    // Check streak-based badges against the fresh per-tier streak values.
    const newBadges = [];
    if (tier && STREAK_THRESHOLDS[tier]) {
      const streakValue = progress.rows[0][`streak_${tier}`];
      for (const [badgeId, threshold] of STREAK_THRESHOLDS[tier]) {
        if (streakValue >= threshold) {
          const awarded = await awardBadge(user_id, badgeId);
          if (awarded) newBadges.push(awarded);
        }
      }
      const combo = await checkComboBadge(user_id, 'awesome_combo', [
        'quick_streak_easy', 'sharp_mind_medium', 'deep_focus_hard',
      ]);
      if (combo) newBadges.push(combo);
    }
    // Badge coin bonuses were applied after `newTotal` was computed, so
    // reflect the final balance (including any bonuses) in the response.
    if (newBadges.length > 0) {
      const refreshed = await pool.query('SELECT total_coins FROM user_progress WHERE user_id = $1', [user_id]);
      progress.rows[0].total_coins = refreshed.rows[0].total_coins;
    }

    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO daily_history (user_id, date, problems_solved, coins_earned)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (user_id, date)
       DO UPDATE SET problems_solved = daily_history.problems_solved + 1, coins_earned = daily_history.coins_earned + $3`,
      [user_id, today, actualDelta]
    );

    await pool.query(
      `INSERT INTO answer_log (user_id, difficulty, question_text, outcome, coins_delta)
       VALUES ($1, $2, $3, $4, $5)`,
      [user_id, difficulty || null, question_text || null, outcome || null, actualDelta]
    );

    // Topic mastery: log the first time this exact question is answered
    // correctly (ON CONFLICT DO NOTHING keeps only the first occurrence).
    if (outcome === 'correct' && question_id) {
      const q = await pool.query('SELECT topic_id FROM questions WHERE id = $1', [question_id]);
      const topicId = q.rows[0]?.topic_id;
      if (topicId) {
        await pool.query(
          `INSERT INTO user_question_mastery (user_id, question_id, topic_id)
           VALUES ($1, $2, $3) ON CONFLICT (user_id, question_id) DO NOTHING`,
          [user_id, question_id, topicId]
        );
      }
    }

    res.json({ ...progress.rows[0], coinsDelta: actualDelta, newBadges });
  } catch (err) {
    console.error('Error updating progress:', err);
    res.status(400).json({ error: err.message });
  }
});

// Coin economy settings — configurable from the parent view
app.get('/api/settings/coins', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM coin_settings WHERE id = 1');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/settings/coins', async (req, res) => {
  const toNonNegativeInt = (v, fallback) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const easy_coins = toNonNegativeInt(req.body.easy_coins, 4);
  const medium_coins = toNonNegativeInt(req.body.medium_coins, 6);
  const hard_coins = toNonNegativeInt(req.body.hard_coins, 10);
  const wrong_coins = toNonNegativeInt(req.body.wrong_coins, 5);
  const skip_coins = toNonNegativeInt(req.body.skip_coins, 2);
  const coins_per_penny = Math.max(1, toNonNegativeInt(req.body.coins_per_penny, 10));
  try {
    const result = await pool.query(
      `UPDATE coin_settings
       SET easy_coins = $1, medium_coins = $2, hard_coins = $3, wrong_coins = $4, skip_coins = $5, coins_per_penny = $6, updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [easy_coins, medium_coins, hard_coins, wrong_coins, skip_coins, coins_per_penny]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reset a child's coin balance back to zero (parent action)
app.post('/api/parent/reset-coins', async (req, res) => {
  const { user_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE user_progress SET total_coins = 0, updated_at = NOW() WHERE user_id = $1 RETURNING *`,
      [user_id]
    );
    res.json(result.rows[0]);
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
      'SELECT * FROM daily_history WHERE user_id = $1 ORDER BY date DESC LIMIT 30',
      [user_id]
    );
    const sessions = await pool.query(
      `SELECT * FROM paper_sessions WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 20`,
      [user_id]
    );
    res.json({ progress: progress.rows[0], history: history.rows, sessions: sessions.rows });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Parent–child linking
app.post('/api/parent/link-child', async (req, res) => {
  const { parent_id, child_username } = req.body;
  try {
    const child = await pool.query(
      "SELECT id, name, username FROM users WHERE username = $1 AND type = 'child'",
      [child_username]
    );
    if (child.rows.length === 0) {
      return res.status(404).json({ error: 'No child account found with that username.' });
    }
    await pool.query(
      'INSERT INTO parent_child (parent_id, child_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [parent_id, child.rows[0].id]
    );
    res.json(child.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/parent/unlink-child', async (req, res) => {
  const { parent_id, child_id } = req.body;
  try {
    await pool.query(
      'DELETE FROM parent_child WHERE parent_id = $1 AND child_id = $2',
      [parent_id, child_id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all linked children for a parent, with their progress and recent sessions
app.get('/api/parent/children/:parent_id', async (req, res) => {
  const { parent_id } = req.params;
  try {
    const children = await pool.query(
      `SELECT u.id, u.name, u.username
       FROM users u
       JOIN parent_child pc ON pc.child_id = u.id
       WHERE pc.parent_id = $1`,
      [parent_id]
    );

    const result = await Promise.all(children.rows.map(async child => {
      const progress = await pool.query(
        'SELECT * FROM user_progress WHERE user_id = $1',
        [child.id]
      );
      const sessions = await pool.query(
        `SELECT * FROM paper_sessions WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 10`,
        [child.id]
      );
      const answerLog = await pool.query(
        `SELECT * FROM answer_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [child.id]
      );
      const mastery = await getTopicMastery(child.id);
      const dailyActivity = await getDailyActivity(child.id, 30);
      return { ...child, progress: progress.rows[0] || null, sessions: sessions.rows, answerLog: answerLog.rows, mastery, dailyActivity };
    }));

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Record a completed paper session
// results (optional): per-question [{ correct, subject, skipped }], in the
// order the paper was played — used to judge comeback/topic/give-up badges.
app.post('/api/papers/complete', async (req, res) => {
  const { user_id, difficulty, level, score, total_questions, time_taken, coins_earned, results } = req.body;
  const paperResults = Array.isArray(results) ? results : [];
  try {
    // Snapshot the previous best time for this exact paper type before
    // inserting the new session, so "most improved" can compare against it.
    let previousBest = null;
    if (level) {
      const prev = await pool.query(
        `SELECT MIN(time_taken) AS best FROM paper_sessions
         WHERE user_id = $1 AND difficulty = $2 AND level = $3 AND time_taken > 0`,
        [user_id, difficulty, level]
      );
      previousBest = prev.rows[0]?.best ?? null;
    }

    const result = await pool.query(
      `INSERT INTO paper_sessions (user_id, difficulty, level, score, total_questions, time_taken, coins_earned)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user_id, difficulty, level || null, score, total_questions, time_taken, coins_earned]
    );

    const newBadges = [];
    const award = async (badgeId) => {
      const awarded = await awardBadge(user_id, badgeId);
      if (awarded) newBadges.push(awarded);
    };

    if (total_questions > 0) {
      await award('finisher');
      if (score === total_questions) await award('clean_sweep');
      else if (score >= total_questions - 2) await award('almost_perfect');
    }

    if (paperResults.length > 0) {
      const wrongCount = paperResults.filter(r => !r.correct).length;
      if (wrongCount >= 5) await award('no_give_up');

      const lastWrongIndex = paperResults.reduce((last, r, i) => (!r.correct ? i : last), -1);
      if (lastWrongIndex >= 0 && lastWrongIndex < paperResults.length - 1) await award('comeback_kid');

      const bySubject = {};
      for (const r of paperResults) {
        if (!r.subject) continue;
        (bySubject[r.subject] = bySubject[r.subject] || []).push(r.correct);
      }
      if (Object.values(bySubject).some(arr => arr.length >= 3 && arr.every(Boolean))) {
        await award('topic_master');
      }
    }

    // Speed badges — only meaningful when we know the tier played and got a
    // real elapsed time.
    if (level && QUESTION_TIME_BY_LEVEL[level] && time_taken > 0 && total_questions > 0) {
      const accuracy = score / total_questions;
      const targetTime = total_questions * QUESTION_TIME_BY_LEVEL[level] * 0.5;
      if (accuracy >= 0.8 && time_taken <= targetTime) await award('speedster');
      if (level === 'easy' && accuracy >= 0.8 && (time_taken / total_questions) < 20) await award('rocket_round');
      if (previousBest !== null && time_taken < previousBest) await award('most_improved_pace');
    }

    // Consistency badges — count consecutive calendar days (ending today,
    // since a session was just recorded) with at least one completed paper.
    const dateRows = await pool.query(
      `SELECT DISTINCT completed_at::date AS d FROM paper_sessions WHERE user_id = $1 ORDER BY d DESC`,
      [user_id]
    );
    const dateStrs = dateRows.rows.map(r => new Date(r.d).toISOString().split('T')[0]);
    let consistencyStreak = dateStrs.length > 0 ? 1 : 0;
    for (let i = 1; i < dateStrs.length; i++) {
      const prevDay = new Date(dateStrs[i - 1] + 'T00:00:00Z');
      const curDay = new Date(dateStrs[i] + 'T00:00:00Z');
      if (prevDay - curDay === 86400000) consistencyStreak++;
      else break;
    }
    if (consistencyStreak >= 3) await award('consistency_3');
    if (consistencyStreak >= 5) await award('consistency_5');
    if (consistencyStreak >= 7) await award('consistency_7');

    res.json({ ...result.rows[0], newBadges });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Earned badges for a user (for the badge shelf UI)
app.get('/api/badges/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await pool.query(
      'SELECT badge_id, earned_at FROM user_badges WHERE user_id = $1 ORDER BY earned_at ASC',
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bookmarked Learn topics for a user
app.get('/api/favorites/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await pool.query(
      'SELECT topic_id FROM user_favorite_topics WHERE user_id = $1 ORDER BY created_at ASC',
      [user_id]
    );
    res.json(result.rows.map(r => r.topic_id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Toggle a topic bookmark on/off, returning the new state.
app.post('/api/favorites/toggle', async (req, res) => {
  const { user_id, topic_id } = req.body;
  if (!user_id || !topic_id) {
    return res.status(400).json({ error: 'user_id and topic_id are required' });
  }
  try {
    const deleted = await pool.query(
      'DELETE FROM user_favorite_topics WHERE user_id = $1 AND topic_id = $2 RETURNING id',
      [user_id, topic_id]
    );
    if (deleted.rows.length > 0) {
      return res.json({ favorited: false });
    }
    await pool.query(
      'INSERT INTO user_favorite_topics (user_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [user_id, topic_id]
    );
    res.json({ favorited: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Marks a Learn topic as viewed ("read") by a child. Idempotent.
app.post('/api/topics/view', async (req, res) => {
  const { user_id, topic_id } = req.body;
  if (!user_id || !topic_id) {
    return res.status(400).json({ error: 'user_id and topic_id are required' });
  }
  try {
    await pool.query(
      'INSERT INTO user_topic_views (user_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [user_id, topic_id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Per-topic mastery: for every topic with at least one linked question, how
// many of that topic's questions (capped at 6) has this user answered
// correctly, and have they opened the lesson.
// mastered = correct >= min(6, total available for that topic).
async function getTopicMastery(userId) {
  const totals = await pool.query(
    `SELECT topic_id, COUNT(*) AS total FROM questions WHERE topic_id IS NOT NULL GROUP BY topic_id`
  );
  const correct = await pool.query(
    `SELECT topic_id, COUNT(DISTINCT question_id) AS correct FROM user_question_mastery WHERE user_id = $1 GROUP BY topic_id`,
    [userId]
  );
  const views = await pool.query(
    `SELECT topic_id FROM user_topic_views WHERE user_id = $1`,
    [userId]
  );
  const correctByTopic = Object.fromEntries(correct.rows.map(r => [r.topic_id, parseInt(r.correct, 10)]));
  const viewedTopics = new Set(views.rows.map(r => r.topic_id));
  return totals.rows.map(r => {
    const total = parseInt(r.total, 10);
    const target = Math.min(6, total);
    const correctCount = correctByTopic[r.topic_id] || 0;
    return {
      topic_id: r.topic_id,
      correct: correctCount,
      target,
      mastered: target > 0 && correctCount >= target,
      viewed: viewedTopics.has(r.topic_id),
    };
  });
}

// Daily activity: papers completed, score, and coins earned per day, for
// the last `days` days.
async function getDailyActivity(userId, days = 30) {
  const papers = await pool.query(
    `SELECT DATE(completed_at) AS date, COUNT(*) AS papers_completed,
            SUM(score) AS total_correct, SUM(total_questions) AS total_questions
     FROM paper_sessions
     WHERE user_id = $1 AND completed_at >= NOW() - ($2 || ' days')::interval
     GROUP BY DATE(completed_at)`,
    [userId, days]
  );
  const history = await pool.query(
    `SELECT date, problems_solved, coins_earned
     FROM daily_history
     WHERE user_id = $1 AND date >= (NOW() - ($2 || ' days')::interval)::date`,
    [userId, days]
  );
  const byDate = {};
  const dateKey = (d) => new Date(d).toISOString().split('T')[0];
  for (const row of papers.rows) {
    byDate[dateKey(row.date)] = {
      date: dateKey(row.date),
      papers_completed: parseInt(row.papers_completed, 10),
      total_correct: parseInt(row.total_correct, 10) || 0,
      total_questions: parseInt(row.total_questions, 10) || 0,
      problems_solved: 0,
      coins_earned: 0,
    };
  }
  for (const row of history.rows) {
    const key = dateKey(row.date);
    if (!byDate[key]) {
      byDate[key] = { date: key, papers_completed: 0, total_correct: 0, total_questions: 0, problems_solved: 0, coins_earned: 0 };
    }
    byDate[key].problems_solved = row.problems_solved;
    byDate[key].coins_earned = row.coins_earned;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

app.get('/api/topics/mastery/:user_id', async (req, res) => {
  try {
    res.json(await getTopicMastery(req.params.user_id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/daily-activity/:user_id', async (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
  try {
    res.json(await getDailyActivity(req.params.user_id, days));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PDF Upload endpoint
app.post('/api/papers/upload', upload.single('file'), async (req, res) => {
  const { user_id, paper_name } = req.body;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
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

// List uploaded papers for a user
app.get('/api/papers/list/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM uploaded_papers WHERE user_id = $1 ORDER BY created_at DESC',
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Serve the built frontend when running as a standalone server.
app.use(express.static(path.join(__dirname, 'dist')));

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
