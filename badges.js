// Achievement badge catalog — shared shape with src/badges.js (client copy).
// Keep both files in sync when adding/editing badges; this one is required by
// server.js (CommonJS), the other is imported by App.jsx (ES module).
//
// tier drives the border/glow color in the UI: bronze | silver | gold | platinum
const BADGES = [
  // --- Streaks (consecutive correct answers within one difficulty tier) ---
  { id: 'warm_up',           name: 'Warm-Up',        icon: '🔥', tier: 'bronze',   coins: 10, category: 'streak',
    description: '4 easy questions correct in a row' },
  { id: 'quick_streak_easy', name: 'Quick Streak',   icon: '⚡', tier: 'silver',   coins: 15, category: 'streak',
    description: '8 easy questions correct in a row' },
  { id: 'sharp_mind_medium', name: 'Sharp Mind',     icon: '🧠', tier: 'silver',   coins: 20, category: 'streak',
    description: '6 medium questions correct in a row' },
  { id: 'deep_focus_hard',   name: 'Deep Focus',     icon: '💎', tier: 'gold',     coins: 30, category: 'streak',
    description: '4 hard questions correct in a row' },
  { id: 'awesome_combo',     name: 'Awesome!',       icon: '🏆', tier: 'platinum', coins: 75, category: 'streak',
    description: 'Earn Quick Streak, Sharp Mind and Deep Focus' },

  // --- Completing a paper ---
  { id: 'finisher',          name: 'Finisher',       icon: '📝', tier: 'bronze',   coins: 15, category: 'paper',
    description: 'Complete your first full paper' },
  { id: 'clean_sweep',       name: 'Clean Sweep',    icon: '💯', tier: 'gold',     coins: 50, category: 'paper',
    description: 'Score 100% on a paper' },
  { id: 'almost_perfect',    name: 'Almost Perfect', icon: '🎯', tier: 'silver',   coins: 25, category: 'paper',
    description: 'Miss no more than 2 on a paper' },
  { id: 'comeback_kid',      name: 'Comeback Kid',   icon: '🔁', tier: 'silver',   coins: 20, category: 'paper',
    description: 'Get one wrong, then finish the rest of the paper correctly' },
  { id: 'topic_master',      name: 'Topic Master',   icon: '🗺️', tier: 'gold',     coins: 30, category: 'paper',
    description: '100% correct on 3+ questions from the same topic in a paper' },
  { id: 'no_give_up',        name: "Don't Give Up",  icon: '🌙', tier: 'bronze',   coins: 20, category: 'paper',
    description: 'Finish a paper even after 5 or more wrong answers' },

  // --- Speed ---
  { id: 'speedster',         name: 'Speedster',      icon: '⏱️', tier: 'gold',     coins: 25, category: 'speed',
    description: 'Finish a paper in under half the allotted time with 80%+ accuracy' },
  { id: 'rocket_round',      name: 'Rocket Round',   icon: '🚀', tier: 'silver',   coins: 20, category: 'speed',
    description: 'Average under 20s per question on an easy paper with 80%+ accuracy' },
  { id: 'most_improved_pace',name: 'Most Improved',  icon: '📈', tier: 'silver',   coins: 15, category: 'speed',
    description: 'Beat your own best time on a paper you have done before' },

  // --- Consistency ---
  { id: 'consistency_3',     name: '3-Day Streak',   icon: '📅', tier: 'bronze',   coins: 15, category: 'consistency',
    description: 'Complete a paper on 3 days in a row' },
  { id: 'consistency_5',     name: '5-Day Streak',   icon: '📅', tier: 'silver',   coins: 30, category: 'consistency',
    description: 'Complete a paper on 5 days in a row' },
  { id: 'consistency_7',     name: '7-Day Streak',   icon: '📅', tier: 'gold',     coins: 60, category: 'consistency',
    description: 'Complete a paper on 7 days in a row' },
];

const BADGE_MAP = Object.fromEntries(BADGES.map(b => [b.id, b]));

// Streak thresholds by level, used by /api/progress/update.
const STREAK_THRESHOLDS = {
  easy: [['warm_up', 4], ['quick_streak_easy', 8]],
  medium: [['sharp_mind_medium', 6]],
  hard: [['deep_focus_hard', 4]],
};

// Per-question time allowance by level (seconds) — mirrors QUESTION_TIME_BY_LEVEL
// in src/App.jsx, used server-side to judge speed badges.
const QUESTION_TIME_BY_LEVEL = { easy: 60, medium: 90, hard: 135 };

module.exports = { BADGES, BADGE_MAP, STREAK_THRESHOLDS, QUESTION_TIME_BY_LEVEL };
