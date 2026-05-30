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
        subject VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add subject column if it doesn't exist yet (idempotent migration)
    await pool.query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject VARCHAR(100);
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

    // Seed Junior Kangaroo 2025 questions (idempotent)
    const kangarooCheck = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE source = 'Junior Kangaroo 2025'"
    );
    if (parseInt(kangarooCheck.rows[0].count) === 0) {
      const kangarooQuestions = [
        {
          text: "Which of the following traffic signs has the greatest number of lines of symmetry? A: right-arrow sign, B: no U-turn sign, C: no-entry (horizontal bar) sign, D: right-curve sign, E: car sign.",
          options: ["A (right arrow)","B (no U-turn)","C (no entry bar)","D (right curve)","E (car)"],
          answer: "C (no entry bar)",
          solution: "The no-entry sign (horizontal bar in circle) has two lines of symmetry — horizontal and vertical. The arrow and car signs have one line each; the U-turn and curve signs have none. So C has the most.",
          subject: "geometry"
        },
        {
          text: "Joseph draws a square with side-length 10 cm. He joins the midpoints of the sides to make a smaller square inside it. What is the area, in cm², of the smaller square?",
          options: ["10","20","30","40","50"],
          answer: "50",
          solution: "The vertices of the smaller square are at the midpoints of the larger square's sides, each 5 cm from a corner. Each of the four corner right-angled triangles has area ½×5×5 = 12.5 cm². Area of smaller square = 100 − 4×12.5 = 50 cm².",
          subject: "geometry"
        },
        {
          text: "Millie's mother wants a knife on the right-hand side and a fork on the left-hand side of each plate. Starting from the arrangement shown (knife left, fork right for all plates), what is the smallest number of knife–fork swaps needed?",
          options: ["1","2","3","5","6"],
          answer: "2",
          solution: "There are 4 items in the wrong place. Each swap fixes 2 items, so the minimum number of swaps is 4 ÷ 2 = 2.",
          subject: "logic"
        },
        {
          text: "On the left side of a room, Jia and Lottie are sleeping facing each other with heads on their pillows. On the right side, Anaya and Isla are sleeping back to back with heads on their pillows. How many of the four girls are sleeping with their right ear on their pillow?",
          options: ["0","1","2","3","4"],
          answer: "2",
          solution: "Jia and Lottie face each other, so exactly one has her right ear down. Anaya and Isla face away from each other, so exactly one has her right ear down. Total = 2.",
          subject: "logic"
        },
        {
          text: "A piece of paper with squares labelled P, Q (top row) and R, S, T (bottom row) is folded along the dotted lines to make an open box placed on a table with the top open. What letter is on the face that is on the table?",
          options: ["P","Q","R","S","T"],
          answer: "Q",
          solution: "When folded: P is opposite S, R is opposite T. Q has no face opposite it, so Q ends up on the table.",
          subject: "geometry"
        },
        {
          text: "Two identical squares of paper are glued together (overlapping at a corner). Which of the following shapes CANNOT be formed? A: house shape (square + triangle roof), B: star/octagon shape, C: rectangle, D: L-shape, E: arrow pointing down.",
          options: ["A (house/triangle top)","B (star shape)","C (rectangle)","D (L-shape)","E (arrow down)"],
          answer: "A (house/triangle top)",
          solution: "The triangle at the top of shape A would need to be equilateral, but the angle at the top is 90° (interior angle of a square), not 60°. So shape A cannot be formed. The others can be made by overlapping the two squares in various ways.",
          subject: "geometry"
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
          subject: "logic"
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
          subject: "geometry"
        },
        {
          text: "Run Ze writes all integers where: the first digit is 1, each following digit is at least as large as the one before it, and the digit sum is 5. How many such integers does he write?",
          options: ["9","8","7","6","5"],
          answer: "5",
          solution: "The integers are: 11111, 1112, 113, 14, and 122. That is 5 integers.",
          subject: "logic"
        },
        {
          text: "An L-shaped tetromino (made of 4 unit squares in an L shape) is to be cut from a 5×5 grid of 25 unit squares. What is the largest number of such pieces that can be cut out?",
          options: ["2","4","5","6","7"],
          answer: "6",
          solution: "Each piece covers 4 squares. Since 25 = 4×6+1, at most 6 pieces could fit, and it is possible to arrange 6 non-overlapping L-tetrominoes in the 5×5 grid.",
          subject: "logic"
        },
        {
          text: "Luigi has some square tables and chairs. Arranging tables singly with 4 chairs each leaves him 6 chairs short. Arranging tables in pairs with 6 chairs per pair leaves 4 chairs over. How many tables did he receive?",
          options: ["8","10","12","14","16"],
          answer: "10",
          solution: "Let the number of tables be 2x. Chairs available = 8x − 6 = 6x + 4, so 2x = 10. Luigi received 10 tables.",
          subject: "algebra"
        },
        {
          text: "Lily wants to make a large triangle from small triangular tiles. She has already placed 7 tiles. What is the smallest number of additional tiles she needs to complete a large triangle?",
          options: ["5","9","12","15","18"],
          answer: "9",
          solution: "The existing shape fits inside a large triangle whose rows contain 7+5+3+1 = 16 tiles. Since 7 tiles are placed, she needs 16 − 7 = 9 more tiles.",
          subject: "geometry"
        },
        {
          text: "Three vertices of rectangle PQRS are at P(1,1), Q(7,4) and R(5,8). What are the co-ordinates of S?",
          options: ["(-1,4)","(0,5)","(-2,6)","(-1,5)","(-1,6)"],
          answer: "(-1,5)",
          solution: "PQ vector: (6,3). SR must equal PQ. S = R − PQ = (5−6, 8−3) = (−1,5).",
          subject: "geometry"
        },
        {
          text: "A large cube is built from 8 small cubes, some painted black and some white. Five faces of the large cube are shown (with 2,1,1,1,1 black squares visible). What does the sixth face look like?",
          options: ["All white (0 black squares)","1 black square top-left","1 black square bottom-right","2 black squares diagonal","2 black squares same side"],
          answer: "All white (0 black squares)",
          solution: "Each small cube has 3 faces on the large cube. Total visible black squares must be a multiple of 3. Five faces show 2+1+1+1+1 = 6 black squares. The sixth face must add 0 black squares (6+0=6, a multiple of 3). So the sixth face is all white.",
          subject: "logic"
        },
        {
          text: "A rectangular swimming pool of length 20 m is surrounded on all four sides by a path 2 m wide. The area of the path equals the area of the pool. What is the width, in metres, of the pool?",
          options: ["6.5","6","5.5","5","4.5"],
          answer: "6",
          solution: "Let width = Y m. Outer rectangle: 24×(Y+4). Path area = 24(Y+4) − 20Y = 20Y. So 96 = 16Y, giving Y = 6.",
          subject: "algebra"
        },
        {
          text: "Kirsten wrote numbers in five of ten circles around a pentagon: 7, 3, 1, 6, 2 (as shown). She fills the remaining five circles so that the sum along each side of the pentagon is equal. What number goes in the circle marked X (between 7 and 2)?",
          options: ["7","8","11","13","15"],
          answer: "13",
          solution: "Setting up equations from equal side sums: q = 9 and X + 2 = q + 6 = 15, so X = 13.",
          subject: "algebra"
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
          `INSERT INTO questions (difficulty, type, text, answer, options, solution, source, subject)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          ['kangaroo', 'multipleChoice', q.text, q.answer, JSON.stringify(q.options), q.solution, 'Junior Kangaroo 2025', q.subject]
        );
      }
      console.log('Seeded 25 Junior Kangaroo 2025 questions');
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
    const coinsMap = { olympiad: 25, kangaroo: 20, year8: 15 };
    const coinsEarned = correct ? (coinsMap[difficulty] || 10) : 0;

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

// Record a completed paper session
app.post('/api/papers/complete', async (req, res) => {
  const { user_id, difficulty, score, total_questions, time_taken, coins_earned } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO paper_sessions (user_id, difficulty, score, total_questions, time_taken, coins_earned)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id, difficulty, score, total_questions, time_taken, coins_earned]
    );
    res.json(result.rows[0]);
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
