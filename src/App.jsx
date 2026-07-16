import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import { BADGES } from './badges';
import { TOPICS, TOPIC_MAP, TOPIC_CATEGORIES } from './topics';
import { FORMULAS } from './formulas';

const API_URL = import.meta.env.VITE_API_URL || '';
const PAPER_QUESTIONS = 15;
// Per-question timer, in seconds, by difficulty tier.
const QUESTION_TIME_BY_LEVEL = { easy: 60, medium: 90, hard: 135 };
const getQuestionTime = (lv) => QUESTION_TIME_BY_LEVEL[lv] || QUESTION_TIME_BY_LEVEL.medium;

// Returns points for a regular polygon, for the 2D-shapes diagram.
const polygonPoints = (cx, cy, r, sides, rotationDeg = -90) => {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const angle = (rotationDeg + (360 / sides) * i) * (Math.PI / 180);
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return points.join(' ');
};

// Small illustrative SVG diagrams for the Learn tab — kept as plain,
// stateless components since they take no props and never change.
function SequenceDiagram() {
  const terms = [3, 7, 11, 15];
  return (
    <svg viewBox="0 0 400 70" className="topic-diagram">
      {terms.map((t, i) => (
        <g key={i}>
          <circle cx={30 + i * 80} cy={35} r="24" className="diagram-chip" />
          <text x={30 + i * 80} y={41} textAnchor="middle" className="diagram-chip-text">{t}</text>
          <text x={30 + i * 80 + 40} y={20} textAnchor="middle" className="diagram-label">+4</text>
        </g>
      ))}
      <circle cx={30 + 4 * 80} cy={35} r="24" className="diagram-chip diagram-chip-next" />
      <text x={30 + 4 * 80} y={41} textAnchor="middle" className="diagram-chip-text">?</text>
    </svg>
  );
}

function ProbabilityScaleDiagram() {
  return (
    <svg viewBox="0 0 360 60" className="topic-diagram">
      <line x1="20" y1="35" x2="340" y2="35" className="diagram-axis" />
      {[0, 0.25, 0.5, 0.75, 1].map((v, i) => {
        const x = 20 + v * 320;
        return (
          <g key={i}>
            <line x1={x} y1="28" x2={x} y2="42" className="diagram-axis" />
            <text x={x} y="58" textAnchor="middle" className="diagram-label">{v}</text>
          </g>
        );
      })}
      <text x="20" y="16" textAnchor="start" className="diagram-label">Impossible</text>
      <text x="180" y="16" textAnchor="middle" className="diagram-label">Even chance</text>
      <text x="340" y="16" textAnchor="end" className="diagram-label">Certain</text>
    </svg>
  );
}

function Shapes2DDiagram() {
  const shapes = [
    { label: 'Triangle', sides: 3 },
    { label: 'Square', sides: 4 },
    { label: 'Pentagon', sides: 5 },
    { label: 'Hexagon', sides: 6 },
  ];
  return (
    <svg viewBox="0 0 570 130" className="topic-diagram">
      {shapes.map((s, i) => (
        <g key={s.label}>
          <polygon points={polygonPoints(60 + i * 110, 50, 34, s.sides)} className="diagram-shape" />
          <text x={60 + i * 110} y="105" textAnchor="middle" className="diagram-label">{s.label}</text>
        </g>
      ))}
      <circle cx={60 + 4 * 110} cy={50} r="34" className="diagram-shape" />
      <text x={60 + 4 * 110} y="105" textAnchor="middle" className="diagram-label">Circle</text>
    </svg>
  );
}

function Shapes3DDiagram() {
  return (
    <svg viewBox="0 0 460 130" className="topic-diagram">
      {/* Cube */}
      <g>
        <polygon points="30,80 70,80 70,40 30,40" className="diagram-shape" />
        <polygon points="45,60 85,60 85,25 45,25" className="diagram-shape diagram-shape-dim" />
        <line x1="30" y1="80" x2="45" y2="60" className="diagram-axis" />
        <line x1="70" y1="80" x2="85" y2="60" className="diagram-axis" />
        <line x1="70" y1="40" x2="85" y2="25" className="diagram-axis" />
        <line x1="30" y1="40" x2="45" y2="25" className="diagram-axis" />
        <text x="55" y="105" textAnchor="middle" className="diagram-label">Cube</text>
      </g>
      {/* Cylinder */}
      <g transform="translate(115,0)">
        <ellipse cx="55" cy="30" rx="30" ry="10" className="diagram-shape" />
        <line x1="25" y1="30" x2="25" y2="65" className="diagram-axis" />
        <line x1="85" y1="30" x2="85" y2="65" className="diagram-axis" />
        <path d="M25,65 A30,10 0 0 0 85,65" className="diagram-shape" fill="none" />
        <text x="55" y="105" textAnchor="middle" className="diagram-label">Cylinder</text>
      </g>
      {/* Sphere */}
      <g transform="translate(230,0)">
        <circle cx="55" cy="45" r="30" className="diagram-shape" />
        <ellipse cx="55" cy="45" rx="30" ry="10" className="diagram-shape" fill="none" />
        <text x="55" y="105" textAnchor="middle" className="diagram-label">Sphere</text>
      </g>
      {/* Cone */}
      <g transform="translate(345,0)">
        <ellipse cx="55" cy="65" rx="30" ry="10" className="diagram-shape" />
        <polygon points="25,65 85,65 55,15" className="diagram-shape" />
        <text x="55" y="105" textAnchor="middle" className="diagram-label">Cone</text>
      </g>
    </svg>
  );
}

function PythagorasDiagram() {
  const x0 = 40, y0 = 140, x1 = 220, y1 = 140, x2 = 40, y2 = 30;
  return (
    <svg viewBox="0 0 260 160" className="topic-diagram">
      <polygon points={`${x0},${y0} ${x1},${y1} ${x2},${y2}`} className="diagram-shape" />
      <rect x={x0} y={y0 - 16} width="16" height="16" className="diagram-right-angle" />
      <text x={(x0 + x1) / 2} y={y0 + 22} textAnchor="middle" className="diagram-label">b</text>
      <text x={x0 - 14} y={(y0 + y2) / 2} textAnchor="middle" className="diagram-label">a</text>
      <text x={(x1 + x2) / 2 + 12} y={(y1 + y2) / 2 - 4} textAnchor="middle" className="diagram-label">c</text>
    </svg>
  );
}

function CoordinatesDiagram() {
  const originX = 40, originY = 150, unit = 30;
  const pointX = originX + 3 * unit;
  const pointY = originY - 2 * unit;
  return (
    <svg viewBox="0 0 300 180" className="topic-diagram">
      {[0, 1, 2, 3, 4, 5].map(x => (
        <line key={`v${x}`} x1={originX + x * unit} y1="10" x2={originX + x * unit} y2="160" className="diagram-grid" />
      ))}
      {[0, 1, 2, 3, 4].map(y => (
        <line key={`h${y}`} x1="10" y1={originY - y * unit} x2="280" y2={originY - y * unit} className="diagram-grid" />
      ))}
      <line x1="10" y1={originY} x2="280" y2={originY} className="diagram-axis" />
      <line x1={originX} y1="10" x2={originX} y2="160" className="diagram-axis" />
      <text x="286" y={originY + 4} className="diagram-label">x</text>
      <text x={originX - 6} y="10" className="diagram-label">y</text>
      <text x={originX - 8} y={originY + 16} textAnchor="end" className="diagram-label">0</text>
      <circle cx={pointX} cy={pointY} r="5" className="diagram-point" />
      <text x={pointX + 10} y={pointY - 8} className="diagram-label">(3, 2)</text>
    </svg>
  );
}

function AnglesDiagram() {
  const cx = 150, cy = 90;
  return (
    <svg viewBox="0 0 300 180" className="topic-diagram">
      <line x1="20" y1={cy} x2="280" y2={cy} className="diagram-axis" />
      <line x1={cx - 65} y1={cy + 65} x2={cx + 65} y2={cy - 65} className="diagram-axis" />
      <text x={cx + 32} y={cy - 22} textAnchor="middle" className="diagram-label">a</text>
      <text x={cx - 40} y={cy - 22} textAnchor="middle" className="diagram-label">b</text>
      <text x={cx - 32} y={cy + 32} textAnchor="middle" className="diagram-label">c</text>
      <text x={cx + 40} y={cy + 32} textAnchor="middle" className="diagram-label">d</text>
    </svg>
  );
}

const DIAGRAMS = {
  sequence: SequenceDiagram,
  'probability-scale': ProbabilityScaleDiagram,
  'shapes-2d': Shapes2DDiagram,
  'shapes-3d': Shapes3DDiagram,
  pythagoras: PythagorasDiagram,
  coordinates: CoordinatesDiagram,
  angles: AnglesDiagram,
};

// Topic mastery grid — shown on both the child's own Progress page and the
// parent's per-child dashboard. A topic is "mastered" once the child has
// correctly answered target (= min(6, questions available)) distinct
// questions tagged with that topic; "viewed" means they've opened the lesson.
function TopicMasteryGrid({ mastery, onOpenTopic }) {
  const byId = Object.fromEntries((mastery || []).map(m => [m.topic_id, m]));
  const masteredCount = (mastery || []).filter(m => m.mastered).length;
  return (
    <div className="mastery-section">
      <h3>🏅 Topic Mastery — {masteredCount} / {TOPICS.length} mastered</h3>
      {TOPIC_CATEGORIES.map(cat => (
        <div key={cat} className="mastery-category-group">
          <h4>{cat}</h4>
          <div className="mastery-grid">
            {TOPICS.filter(t => t.category === cat).map(t => {
              const m = byId[t.id];
              const correct = m?.correct || 0;
              const target = m?.target ?? 0;
              const mastered = m?.mastered || false;
              const viewed = m?.viewed || false;
              const status = mastered ? 'mastered' : correct > 0 ? 'learning' : viewed ? 'read' : 'not-started';
              const label = mastered ? '⭐ Mastered' : correct > 0 ? `${correct}/${target} correct` : viewed ? '📖 Read' : 'Not started yet';
              const Tag = onOpenTopic ? 'button' : 'div';
              return (
                <Tag
                  key={t.id}
                  className={`mastery-card ${status}`}
                  onClick={onOpenTopic ? () => onOpenTopic(t.id) : undefined}
                >
                  <span className="mastery-icon">{t.icon}</span>
                  <div className="mastery-info">
                    <span className="mastery-title">{t.title}</span>
                    <span className="mastery-status">{label}</span>
                  </div>
                </Tag>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Daily activity table — papers completed, score and coins earned per day.
function DailyActivityTable({ activity }) {
  const days = [...(activity || [])].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="sessions-card">
      <h3>Daily Activity</h3>
      {days.length === 0 ? (
        <p className="graph-empty">No papers completed yet.</p>
      ) : (
        <table className="sessions-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Papers Completed</th>
              <th>Score</th>
              <th>Coins Earned</th>
            </tr>
          </thead>
          <tbody>
            {days.map(d => {
              const pct = d.total_questions > 0 ? Math.round((d.total_correct / d.total_questions) * 100) : null;
              return (
                <tr key={d.date}>
                  <td>{new Date(d.date).toLocaleDateString()}</td>
                  <td>{d.papers_completed}</td>
                  <td>
                    {pct === null ? '—' : (
                      <span className={`score-pill ${pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red'}`}>
                        {d.total_correct}/{d.total_questions} ({pct}%)
                      </span>
                    )}
                  </td>
                  <td>💰 {d.coins_earned}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TopicDetail({ topic, onBack, isFavorite, onToggleFavorite }) {
  if (!topic) return null;
  const Diagram = DIAGRAMS[topic.diagram];
  return (
    <div className="topic-detail">
      <button className="btn-back" onClick={onBack}>← Back to Learn</button>
      <div className="topic-detail-header">
        <span className="topic-detail-icon">{topic.icon}</span>
        <div className="topic-detail-titlewrap">
          <h2>{topic.title}</h2>
          <p className="topic-detail-summary">{topic.summary}</p>
        </div>
        <button
          className={`topic-favorite-star large ${isFavorite ? 'active' : ''}`}
          onClick={onToggleFavorite}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? '⭐' : '☆'}
        </button>
      </div>
      {Diagram && (
        <div className="topic-diagram-wrap">
          <Diagram />
        </div>
      )}
      {FORMULAS[topic.id] && (
        <div className="formula-callout">
          <h3>📐 Formula to Master</h3>
          {FORMULAS[topic.id].map((f, i) => (
            <div key={i} className="formula-callout-item">
              <span className="formula-callout-name">{f.name}</span>
              <span className="formula-callout-expression">{f.expression}</span>
              {f.note && <span className="formula-callout-note">{f.note}</span>}
            </div>
          ))}
        </div>
      )}
      {topic.sections.map((s, i) => (
        <div key={i} className="topic-section">
          <h3>{s.heading}</h3>
          <p>{s.body}</p>
          {s.example && (
            <div className="example-box">
              <div className="example-question"><strong>Example:</strong> {s.example.question}</div>
              <ul className="example-working">
                {s.example.working.map((line, j) => <li key={j}>{line}</li>)}
              </ul>
              <div className="example-answer">Answer: {s.example.answer}</div>
            </div>
          )}
        </div>
      ))}
      {topic.keyFacts && topic.keyFacts.length > 0 && (
        <div className="key-facts-box">
          <h3>🔑 Key Facts</h3>
          <ul>
            {topic.keyFacts.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [page, setPage] = useState('login');
  const [learnTopic, setLearnTopic] = useState(null); // topic id | null (topic list)
  const [learnSearch, setLearnSearch] = useState('');
  const [learnCategoryFilter, setLearnCategoryFilter] = useState('All');
  const [formulaSearch, setFormulaSearch] = useState('');
  const [formulaCategoryFilter, setFormulaCategoryFilter] = useState('All');
  const [favoriteTopics, setFavoriteTopics] = useState([]); // topic ids
  const [topicMastery, setTopicMastery] = useState([]); // [{ topic_id, correct, target, mastered, viewed }]
  const [dailyActivity, setDailyActivity] = useState([]); // [{ date, papers_completed, total_correct, total_questions, coins_earned }]
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [difficulty, setDifficulty] = useState('year6');
  const [level, setLevel] = useState('medium');
  const [progress, setProgress] = useState(null);
  const [sessions, setSessions] = useState([]);

  // Parent upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadStatus, setUploadStatus] = useState(null); // null | 'uploading' | 'success' | 'error'
  const [uploadedPapers, setUploadedPapers] = useState([]);

  // Parent–child linking state
  const [children, setChildren] = useState([]);
  const [linkUsername, setLinkUsername] = useState('');
  const [linkStatus, setLinkStatus] = useState(null); // null | 'linking' | {error} | 'ok'
  const [selectedChild, setSelectedChild] = useState(null);

  // Paper-level state
  const [paperActive, setPaperActive] = useState(false);
  const [paperComplete, setPaperComplete] = useState(false);
  const [paperStartTime, setPaperStartTime] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [paperResults, setPaperResults] = useState([]);

  // Per-question state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState(getQuestionTime(level));

  // Coin economy — configurable from the parent view
  const [coinSettings, setCoinSettings] = useState({ easy_coins: 4, medium_coins: 6, hard_coins: 10, wrong_coins: 5, skip_coins: 2, coins_per_penny: 10 });
  const [coinSettingsDraft, setCoinSettingsDraft] = useState(null);
  const [coinSettingsStatus, setCoinSettingsStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [coinToast, setCoinToast] = useState(null); // { delta } | null
  const coinToastTimeout = useRef(null);

  // Achievement badges — earnedBadges is the persisted set (for the badge
  // shelf); badgeQueue holds newly-unlocked badges waiting to be celebrated
  // one at a time via the animated unlock popup.
  const [earnedBadges, setEarnedBadges] = useState([]); // [{ badge_id, earned_at }]
  const [badgeQueue, setBadgeQueue] = useState([]);
  const [activeBadge, setActiveBadge] = useState(null);
  const badgeTimeout = useRef(null);

  useEffect(() => {
    axios.get(`${API_URL}/api/settings/coins`).then(r => {
      setCoinSettings(r.data);
      setCoinSettingsDraft(r.data);
    }).catch(() => {});
  }, []);

  // Surface connectivity changes — the app shell and Learn tab keep working
  // offline (service-worker cached), but questions/coins/badges need a
  // network round-trip, so make dropped connectivity visible rather than
  // let actions silently fail.
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const flashCoinToast = (delta) => {
    if (coinToastTimeout.current) clearTimeout(coinToastTimeout.current);
    setCoinToast({ delta });
    coinToastTimeout.current = setTimeout(() => setCoinToast(null), 1800);
  };

  const loadBadges = async (userId) => {
    try {
      const r = await axios.get(`${API_URL}/api/badges/${userId}`);
      setEarnedBadges(r.data);
    } catch (err) {
      console.error('Error loading badges:', err);
    }
  };

  const loadFavorites = async (userId) => {
    try {
      const r = await axios.get(`${API_URL}/api/favorites/${userId}`);
      setFavoriteTopics(r.data);
    } catch (err) {
      console.error('Error loading favorite topics:', err);
    }
  };

  const toggleFavorite = async (topicId) => {
    if (!currentUser) return;
    // Optimistic update — flip locally immediately, reconcile with the
    // server's response (falls back to a reload of the list on error).
    const wasFavorite = favoriteTopics.includes(topicId);
    setFavoriteTopics(prev => wasFavorite ? prev.filter(id => id !== topicId) : [...prev, topicId]);
    try {
      await axios.post(`${API_URL}/api/favorites/toggle`, { user_id: currentUser.id, topic_id: topicId });
    } catch (err) {
      console.error('Error toggling favorite topic:', err);
      loadFavorites(currentUser.id);
    }
  };

  const markTopicViewed = (userId, topicId) => {
    axios.post(`${API_URL}/api/topics/view`, { user_id: userId, topic_id: topicId }).catch(() => {});
  };

  const loadTopicMastery = async (userId) => {
    try {
      const r = await axios.get(`${API_URL}/api/topics/mastery/${userId}`);
      setTopicMastery(r.data);
    } catch (err) {
      console.error('Error loading topic mastery:', err);
    }
  };

  const loadDailyActivity = async (userId) => {
    try {
      const r = await axios.get(`${API_URL}/api/daily-activity/${userId}`);
      setDailyActivity(r.data);
    } catch (err) {
      console.error('Error loading daily activity:', err);
    }
  };

  const queueNewBadges = (badges) => {
    if (!badges || badges.length === 0) return;
    setBadgeQueue(prev => [...prev, ...badges]);
  };

  // Pop one badge at a time off the queue into the celebratory popup.
  useEffect(() => {
    if (activeBadge || badgeQueue.length === 0) return;
    const [next, ...rest] = badgeQueue;
    setActiveBadge(next);
    setBadgeQueue(rest);
    if (currentUser) loadBadges(currentUser.id);
    if (badgeTimeout.current) clearTimeout(badgeTimeout.current);
    badgeTimeout.current = setTimeout(() => setActiveBadge(null), 3400);
  }, [badgeQueue, activeBadge, currentUser]);

  const formatCoinValue = (coins) => {
    const perPenny = coinSettings.coins_per_penny || 10;
    return `£${(coins / perPenny / 100).toFixed(2)}`;
  };

  // Question ids already served in the current paper, so a 15-question paper
  // draws each question at most once while its tier still has unused ones.
  const seenQuestionIdsRef = useRef([]);

  const loadQuestion = async () => {
    try {
      const exclude = seenQuestionIdsRef.current.join(',');
      const response = await axios.get(`${API_URL}/api/questions/${difficulty}`, { params: { level, exclude } });
      if (response.data?.id) seenQuestionIdsRef.current.push(response.data.id);
      setCurrentQuestion(response.data);
      setAnswered(false);
      setUserAnswer('');
      setResult(null);
      setQuestionTimeRemaining(getQuestionTime(response.data?.level || level));
    } catch (err) {
      console.error('Error loading question:', err);
    }
  };

  const startPaper = async () => {
    setPaperStartTime(Date.now());
    setPaperActive(true);
    setPaperComplete(false);
    setQuestionIndex(0);
    setPaperResults([]);
    seenQuestionIdsRef.current = [];
    try {
      const response = await axios.get(`${API_URL}/api/questions/${difficulty}`, { params: { level } });
      if (response.data?.id) seenQuestionIdsRef.current.push(response.data.id);
      setCurrentQuestion(response.data);
      setAnswered(false);
      setUserAnswer('');
      setResult(null);
      setQuestionTimeRemaining(getQuestionTime(response.data?.level || level));
    } catch (err) {
      console.error('Error loading question:', err);
    }
  };

  const handleLogin = async (e, creds) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const credentials = creds || loginForm;
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, credentials);
      setCurrentUser(response.data);
      setProgress(response.data.progress);
      setPage(response.data.type === 'child' ? 'challenge' : 'parentDash');
      setLoginForm({ username: '', password: '' });
      if (response.data.type === 'child') {
        loadBadges(response.data.id);
        loadFavorites(response.data.id);
      }
      if (response.data.type === 'parent') {
        const pid = response.data.id;
        axios.get(`${API_URL}/api/papers/list/${pid}`).then(r => setUploadedPapers(r.data)).catch(() => {});
        axios.get(`${API_URL}/api/parent/children/${pid}`).then(r => {
          setChildren(r.data);
          if (r.data.length > 0) setSelectedChild(r.data[0]);
        }).catch(() => {});
      }
    } catch (err) {
      alert('Login failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || answered) return;
    const expected = (currentQuestion.answer ?? '').toString().toLowerCase().trim();
    const correct = userAnswer.toLowerCase().trim() === expected;
    try {
      const response = await axios.post(`${API_URL}/api/progress/update`, {
        user_id: currentUser.id,
        outcome: correct ? 'correct' : 'incorrect',
        difficulty,
        question_text: currentQuestion.text,
        question_level: currentQuestion.level,
        question_id: currentQuestion.id
      });
      const coinsDelta = response.data.coinsDelta ?? 0;
      setResult({ correct, expected: currentQuestion.answer, coinsDelta });
      setAnswered(true);
      setPaperResults(prev => [...prev, { correct, subject: currentQuestion.subject, topicId: currentQuestion.topic_id, coinsDelta }]);
      flashCoinToast(coinsDelta);
      queueNewBadges(response.data.newBadges);
      const progressResponse = await axios.get(`${API_URL}/api/progress/${currentUser.id}`);
      setProgress(progressResponse.data.progress);
      setSessions(progressResponse.data.sessions || []);
    } catch (err) {
      console.error('Error submitting answer:', err);
    }
  };

  const finishPaper = async (results) => {
    setPaperActive(false);
    setPaperComplete(true);
    setCurrentQuestion(null);
    const correctCount = results.filter(r => r.correct).length;
    const timeTaken = paperStartTime ? Math.round((Date.now() - paperStartTime) / 1000) : 0;
    const coinsEarned = results.reduce((sum, r) => sum + (r.coinsDelta || 0), 0);
    try {
      const response = await axios.post(`${API_URL}/api/papers/complete`, {
        user_id: currentUser.id,
        difficulty,
        level,
        score: correctCount,
        total_questions: results.length,
        time_taken: timeTaken,
        coins_earned: coinsEarned,
        results: results.map(r => ({ correct: r.correct, subject: r.subject, skipped: !!r.skipped }))
      });
      queueNewBadges(response.data.newBadges);
      const progressResponse = await axios.get(`${API_URL}/api/progress/${currentUser.id}`);
      setProgress(progressResponse.data.progress);
      setSessions(progressResponse.data.sessions || []);
    } catch (err) {
      console.error('Error recording paper session:', err);
    }
  };

  const handleNextQuestion = () => {
    const nextIndex = questionIndex + 1;
    if (nextIndex >= PAPER_QUESTIONS) {
      finishPaper(paperResults);
    } else {
      setQuestionIndex(nextIndex);
      loadQuestion();
    }
  };

  // Called when the per-question 1-minute timer runs out. The question is
  // recorded as an incorrect/skipped attempt and the paper moves on immediately.
  const handleSkipQuestion = async () => {
    if (!currentQuestion || answered) return;
    let coinsDelta = 0;
    try {
      const response = await axios.post(`${API_URL}/api/progress/update`, {
        user_id: currentUser.id,
        outcome: 'skipped',
        difficulty,
        question_text: currentQuestion.text,
        question_level: currentQuestion.level
      });
      coinsDelta = response.data.coinsDelta ?? 0;
      flashCoinToast(coinsDelta);
      queueNewBadges(response.data.newBadges);
      const progressResponse = await axios.get(`${API_URL}/api/progress/${currentUser.id}`);
      setProgress(progressResponse.data.progress);
      setSessions(progressResponse.data.sessions || []);
    } catch (err) {
      console.error('Error recording skipped question:', err);
    }
    const newResults = [...paperResults, { correct: false, subject: currentQuestion.subject, topicId: currentQuestion.topic_id, skipped: true, coinsDelta }];
    setPaperResults(newResults);

    const nextIndex = questionIndex + 1;
    if (nextIndex >= PAPER_QUESTIONS) {
      finishPaper(newResults);
    } else {
      setQuestionIndex(nextIndex);
      loadQuestion();
    }
  };

  // Per-question countdown timer — duration depends on the question's tier
  // (see getQuestionTime). The updater only decrements state (kept pure, no
  // side effects); a separate effect below reacts to it hitting zero and
  // triggers the skip exactly once.
  useEffect(() => {
    if (!paperActive || !currentQuestion || answered) return;
    const interval = setInterval(() => {
      setQuestionTimeRemaining(t => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [paperActive, currentQuestion, answered]);

  useEffect(() => {
    if (paperActive && currentQuestion && !answered && questionTimeRemaining === 0) {
      handleSkipQuestion();
    }
  }, [questionTimeRemaining]);

  // Load sessions when going to progress page
  useEffect(() => {
    if (page === 'progress' && currentUser) {
      axios.get(`${API_URL}/api/progress/${currentUser.id}`).then(r => {
        setProgress(r.data.progress);
        setSessions(r.data.sessions || []);
      }).catch(() => {});
      loadBadges(currentUser.id);
      loadTopicMastery(currentUser.id);
      loadDailyActivity(currentUser.id);
    }
  }, [page]);

  const demoLogin = (username, password) => {
    setLoginForm({ username, password });
    handleLogin(null, { username, password });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeTaken = (seconds) => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const parseOptions = (raw) => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  };

  // Renders a solution string as a sequence of labelled steps/formulas/examples,
  // grouping consecutive "Diagram:" lines into a monospace block.
  const renderSolution = (solution) => {
    if (!solution) return null;
    const lines = solution.split('\n');
    const elements = [];
    let diagramLines = null;

    const flushDiagram = () => {
      if (diagramLines) {
        elements.push(
          <pre key={`diagram-${elements.length}`} className="solution-diagram">
            {diagramLines.join('\n')}
          </pre>
        );
        diagramLines = null;
      }
    };

    lines.forEach((rawLine, i) => {
      const line = rawLine.trim();
      if (line.startsWith('Diagram:')) {
        flushDiagram();
        diagramLines = [line.replace(/^Diagram:\s*/, '')];
        return;
      }
      if (diagramLines && line !== '' && !/^(Step\s*\d*:|Formula:|Example:)/.test(line)) {
        diagramLines.push(rawLine);
        return;
      }
      flushDiagram();
      if (line === '') return;
      let className = 'solution-line';
      if (/^Formula:/.test(line)) className += ' solution-formula';
      else if (/^Example:/.test(line)) className += ' solution-example';
      else if (/^Step\s*\d*:/.test(line)) className += ' solution-step';
      elements.push(<p key={i} className={className}>{line}</p>);
    });
    flushDiagram();
    return elements;
  };

  const difficultyLabel = (d) => {
    if (d === 'olympiad') return 'Olympiad';
    if (d === 'kangaroo') return 'Kangaroo';
    return d.replace('year', 'Year ');
  };

  const levelLabel = (lv) => {
    if (lv === 'easy') return 'Easy';
    if (lv === 'hard') return 'Hard';
    return 'Medium';
  };

  const handleUploadPaper = async () => {
    if (!uploadFile || !uploadName.trim()) {
      setUploadStatus('error');
      return;
    }
    setUploadStatus('uploading');
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('user_id', currentUser.id);
      formData.append('paper_name', uploadName.trim());
      const response = await axios.post(`${API_URL}/api/papers/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadedPapers(prev => [response.data, ...prev]);
      setUploadFile(null);
      setUploadName('');
      setUploadStatus('success');
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadStatus('error');
    }
  };

  const loadUploadedPapers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/papers/list/${currentUser.id}`);
      setUploadedPapers(response.data);
    } catch (err) {
      console.error('Error loading papers:', err);
    }
  };

  const handleLinkChild = async () => {
    if (!linkUsername.trim()) return;
    setLinkStatus('linking');
    try {
      const response = await axios.post(`${API_URL}/api/parent/link-child`, {
        parent_id: currentUser.id,
        child_username: linkUsername.trim()
      });
      const newChild = response.data;
      // Fetch full child data (progress + sessions)
      const fullData = await axios.get(`${API_URL}/api/parent/children/${currentUser.id}`);
      setChildren(fullData.data);
      const linked = fullData.data.find(c => c.id === newChild.id) || fullData.data[0];
      setSelectedChild(linked);
      setLinkUsername('');
      setLinkStatus('ok');
      setTimeout(() => setLinkStatus(null), 3000);
    } catch (err) {
      setLinkStatus({ error: err.response?.data?.error || 'Could not link child.' });
    }
  };

  const handleUnlinkChild = async (childId) => {
    try {
      await axios.delete(`${API_URL}/api/parent/unlink-child`, {
        data: { parent_id: currentUser.id, child_id: childId }
      });
      const updated = children.filter(c => c.id !== childId);
      setChildren(updated);
      setSelectedChild(updated.length > 0 ? updated[0] : null);
    } catch (err) {
      console.error('Unlink error:', err);
    }
  };

  const handleResetCoins = async (childId) => {
    if (!window.confirm("Reset this child's coin balance to 0?")) return;
    try {
      await axios.post(`${API_URL}/api/parent/reset-coins`, { user_id: childId });
      const fullData = await axios.get(`${API_URL}/api/parent/children/${currentUser.id}`);
      setChildren(fullData.data);
      const updated = fullData.data.find(c => c.id === childId);
      if (updated) setSelectedChild(updated);
    } catch (err) {
      console.error('Error resetting coins:', err);
    }
  };

  const handleSaveCoinSettings = async () => {
    setCoinSettingsStatus('saving');
    try {
      const payload = {
        easy_coins: parseInt(coinSettingsDraft.easy_coins, 10) || 0,
        medium_coins: parseInt(coinSettingsDraft.medium_coins, 10) || 0,
        hard_coins: parseInt(coinSettingsDraft.hard_coins, 10) || 0,
        wrong_coins: parseInt(coinSettingsDraft.wrong_coins, 10) || 0,
        skip_coins: parseInt(coinSettingsDraft.skip_coins, 10) || 0,
        coins_per_penny: Math.max(1, parseInt(coinSettingsDraft.coins_per_penny, 10) || 1)
      };
      const response = await axios.put(`${API_URL}/api/settings/coins`, payload);
      setCoinSettings(response.data);
      setCoinSettingsDraft(response.data);
      setCoinSettingsStatus('saved');
      setTimeout(() => setCoinSettingsStatus(null), 2500);
    } catch (err) {
      console.error('Error saving coin settings:', err);
      setCoinSettingsStatus('error');
    }
  };

  const handleQuitPaper = () => {
    setPaperActive(false);
    setPaperComplete(true);
  };

  // Build 30-day graph data from sessions
  const buildGraphData = () => {
    const today = new Date();
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({ date: dateStr, label: i % 7 === 0 ? `${d.getDate()}/${d.getMonth()+1}` : '' });
    }
    const sessionsByDate = {};
    sessions.forEach(s => {
      const dateStr = new Date(s.completed_at).toISOString().split('T')[0];
      if (!sessionsByDate[dateStr]) sessionsByDate[dateStr] = [];
      sessionsByDate[dateStr].push(s);
    });
    return days.map(d => {
      const daySessions = sessionsByDate[d.date] || [];
      const avgPct = daySessions.length > 0
        ? daySessions.reduce((sum, s) => sum + (s.score / s.total_questions) * 100, 0) / daySessions.length
        : null;
      return { ...d, pct: avgPct, count: daySessions.length };
    });
  };

  // Subject breakdown from recent sessions results (using paper results in state)
  const getSubjectBreakdown = () => {
    // Tally from in-memory paperResults (current session subjects)
    // For a richer view, we'd store per-question subject data server-side
    const map = {};
    paperResults.forEach(r => {
      const s = r.subject || 'general';
      if (!map[s]) map[s] = { correct: 0, total: 0 };
      map[s].total++;
      if (r.correct) map[s].correct++;
    });
    return Object.entries(map).map(([subject, data]) => ({
      subject,
      pct: Math.round((data.correct / data.total) * 100),
      total: data.total
    })).sort((a, b) => a.pct - b.pct);
  };

  // Topics (linked to Learn tab lessons) where most of this paper's answers
  // on that topic were wrong — surfaced as a "review this" suggestion.
  const getWeakTopics = () => {
    const map = {};
    paperResults.forEach(r => {
      if (!r.topicId || !TOPIC_MAP[r.topicId]) return;
      if (!map[r.topicId]) map[r.topicId] = { correct: 0, total: 0 };
      map[r.topicId].total++;
      if (r.correct) map[r.topicId].correct++;
    });
    return Object.entries(map)
      .filter(([, data]) => data.correct < data.total / 2)
      .map(([topicId, data]) => ({ topicId, ...data, topic: TOPIC_MAP[topicId] }));
  };

  const openTopic = (topicId) => {
    setLearnTopic(topicId);
    if (currentUser) markTopicViewed(currentUser.id, topicId);
  };

  const goToTopic = (topicId) => {
    openTopic(topicId);
    setPage('learn');
  };

  if (!currentUser) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>📚 Maths Olympiad Prep</h1>
          <p>Master maths with daily challenges</p>

          <form onSubmit={handleLogin} className="login-form">
            <input
              type="text"
              placeholder="Username"
              value={loginForm.username}
              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
              required
            />
            <button type="submit">Login</button>
          </form>

          <div className="demo-accounts">
            <h3>Demo Accounts</h3>
            <button className="demo-btn" onClick={() => demoLogin('child', 'child123')}>
              👦 Child (child/child123)
            </button>
            <button className="demo-btn" onClick={() => demoLogin('parent1', 'parent123')}>
              👨 Parent 1 (parent1/parent123)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser.type === 'child') {
    const timerWarning = questionTimeRemaining <= 15;
    const correctCount = paperResults.filter(r => r.correct).length;
    const graphData = buildGraphData();
    const subjectBreakdown = getSubjectBreakdown();
    const weakTopics = getWeakTopics();

    // SVG graph dimensions
    const W = 600, H = 140, gpad = { top: 10, right: 10, bottom: 30, left: 30 };
    const innerW = W - gpad.left - gpad.right;
    const innerH = H - gpad.top - gpad.bottom;
    const pointsWithData = graphData.filter(d => d.pct !== null);
    const polyline = pointsWithData.map((d) => {
      const xi = graphData.indexOf(d);
      const x = gpad.left + (xi / 29) * innerW;
      const y = gpad.top + (1 - d.pct / 100) * innerH;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="app">
        {!isOnline && (
          <div className="offline-banner">
            ⚠️ You're offline — Learn is still readable, but new questions and saved progress need a connection.
          </div>
        )}
        {paperActive && currentQuestion && !answered && (
          <div className={`paper-timer${timerWarning ? ' warning' : ''}`}>
            <div className="paper-timer-label">Time Left</div>
            <div className="paper-timer-value">{formatTime(questionTimeRemaining)}</div>
          </div>
        )}

        {coinToast && (
          <div className={`coin-toast ${coinToast.delta >= 0 ? 'gain' : 'loss'}`}>
            {coinToast.delta >= 0 ? '+' : ''}{coinToast.delta} coins
          </div>
        )}

        {activeBadge && (
          <div className="badge-unlock-overlay">
            <div className={`badge-unlock-card tier-${activeBadge.tier}`}>
              <div className="badge-unlock-burst" />
              <div className="badge-unlock-icon">{activeBadge.icon}</div>
              <div className="badge-unlock-label">Badge Unlocked!</div>
              <div className="badge-unlock-name">{activeBadge.name}</div>
              <div className="badge-unlock-desc">{activeBadge.description}</div>
              <div className="badge-unlock-coins">+{activeBadge.coins} bonus coins</div>
            </div>
          </div>
        )}

        <header className="header">
          <h1>📚 Maths Olympiad</h1>
          <div className="user-info">
            <span>{currentUser.name}</span>
            <span>💰 {progress?.total_coins || 0} <small>({formatCoinValue(progress?.total_coins || 0)})</small></span>
            <button onClick={() => setCurrentUser(null)}>Logout</button>
          </div>
        </header>

        <nav className="nav">
          <button
            className={page === 'challenge' ? 'active' : ''}
            onClick={() => setPage('challenge')}
          >
            ❓ Challenge
          </button>
          <button
            className={page === 'progress' ? 'active' : ''}
            onClick={() => setPage('progress')}
          >
            📊 Progress
          </button>
          <button
            className={page === 'learn' ? 'active' : ''}
            onClick={() => setPage('learn')}
          >
            📘 Learn
          </button>
          <button
            className={page === 'formulas' ? 'active' : ''}
            onClick={() => setPage('formulas')}
          >
            📐 Formulas
          </button>
        </nav>

        <div className="content">
          {page === 'challenge' && (
            <div className="challenge-container">

              {!paperActive && !paperComplete && (
                <div className="difficulty-selector">
                  <label>Year Level:</label>
                  {['year6', 'year7', 'year8', 'olympiad', 'kangaroo'].map(y => (
                    <label key={y}>
                      <input
                        type="radio"
                        value={y}
                        checked={difficulty === y}
                        onChange={(e) => setDifficulty(e.target.value)}
                      />
                      {difficultyLabel(y)}
                    </label>
                  ))}
                </div>
              )}

              {!paperActive && !paperComplete && (
                <div className="difficulty-selector">
                  <label>Level:</label>
                  {['easy', 'medium', 'hard'].map(lv => (
                    <label key={lv}>
                      <input
                        type="radio"
                        value={lv}
                        checked={level === lv}
                        onChange={(e) => setLevel(e.target.value)}
                      />
                      {levelLabel(lv)}
                    </label>
                  ))}
                </div>
              )}

              {!paperActive && !paperComplete && (
                <div className="paper-start">
                  <h2>Ready for a challenge?</h2>
                  <p>{PAPER_QUESTIONS} questions &middot; {getQuestionTime(level)} seconds per question &middot; {difficultyLabel(difficulty)} &middot; {levelLabel(level)}</p>
                  <button className="btn-primary" onClick={startPaper}>Start Paper</button>
                </div>
              )}

              {paperComplete && (
                <div className="paper-complete">
                  <h2>Paper Complete!</h2>
                  <div className="paper-score">{correctCount} / {paperResults.length}</div>
                  <p className="score-message">
                    {correctCount >= 12 ? '🌟 Excellent!' :
                     correctCount >= 8  ? '👍 Good work!' :
                                          '💪 Keep practising!'}
                  </p>
                  <p className="coin-net-summary">
                    {(() => {
                      const net = paperResults.reduce((sum, r) => sum + (r.coinsDelta || 0), 0);
                      return `${net >= 0 ? '+' : ''}${net} coins this paper (${formatCoinValue(Math.abs(net))})`;
                    })()}
                  </p>
                  {paperResults.some(r => r.skipped) && (
                    <p className="time-up">
                      ⏰ {paperResults.filter(r => r.skipped).length} question{paperResults.filter(r => r.skipped).length !== 1 ? 's' : ''} skipped (1-minute timer ran out)
                    </p>
                  )}
                  {subjectBreakdown.length > 0 && (
                    <div className="subject-breakdown">
                      <h3>Subject Breakdown</h3>
                      {subjectBreakdown.map(s => (
                        <div key={s.subject} className="subject-row">
                          <span className="subject-name">{s.subject}</span>
                          <div className="subject-bar-wrap">
                            <div
                              className={`subject-bar ${s.pct < 60 ? 'weak' : s.pct < 80 ? 'ok' : 'strong'}`}
                              style={{ width: `${s.pct}%` }}
                            />
                          </div>
                          <span className="subject-pct">{s.pct}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {weakTopics.length > 0 && (
                    <div className="weak-topics">
                      <h3>📘 Worth a Review</h3>
                      <p className="weak-topics-hint">You got most of these wrong this paper — a quick read might help next time.</p>
                      {weakTopics.map(w => (
                        <div key={w.topicId} className="weak-topic-row">
                          <span className="weak-topic-icon">{w.topic.icon}</span>
                          <div className="weak-topic-info">
                            <span className="weak-topic-name">{w.topic.title}</span>
                            <span className="weak-topic-score">{w.correct}/{w.total} correct this paper</span>
                          </div>
                          <button className="btn-secondary" onClick={() => goToTopic(w.topicId)}>
                            Review in Learn →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    className="btn-primary"
                    onClick={() => { setPaperComplete(false); setCurrentQuestion(null); setPaperResults([]); }}
                  >
                    Start New Paper
                  </button>
                </div>
              )}

              {paperActive && currentQuestion && (
                <div className="question-card">
                  <div className="question-header">
                    <span className="badge">{difficultyLabel(difficulty)}</span>
                    {currentQuestion.level && (
                      <span className={`badge badge-level-${currentQuestion.level}`}>{levelLabel(currentQuestion.level)}</span>
                    )}
                    <span className="question-counter">
                      Question {questionIndex + 1} of {PAPER_QUESTIONS}
                    </span>
                    <button className="btn-quit" onClick={handleQuitPaper}>✕ Quit</button>
                  </div>
                  <h2>{currentQuestion.text}</h2>

                  {currentQuestion.image_url && (
                    <div className="question-image">
                      <img src={currentQuestion.image_url} alt="Question diagram" />
                    </div>
                  )}

                  {!answered ? (
                    <div className="answer-section">
                      {parseOptions(currentQuestion.options) ? (
                        <div className="choices">
                          {parseOptions(currentQuestion.options).map(opt => (
                            <button
                              key={opt}
                              className={`choice ${userAnswer === opt ? 'selected' : ''}`}
                              onClick={() => setUserAnswer(opt)}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Enter your answer..."
                          value={userAnswer}
                          onChange={(e) => setUserAnswer(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                        />
                      )}
                      <button className="btn-primary" onClick={handleSubmitAnswer}>
                        Submit Answer
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className={`result ${result.correct ? 'correct' : 'incorrect'}`}>
                        {result.correct
                          ? `✓ Correct! +${result.coinsDelta} coins`
                          : `✗ Incorrect — answer: ${result.expected} (${result.coinsDelta} coins)`}
                      </div>
                      <div className="solution">
                        <h3>Solution</h3>
                        <div className="solution-body">{renderSolution(currentQuestion.solution)}</div>
                      </div>
                      <button className="btn-primary" onClick={handleNextQuestion}>
                        {questionIndex + 1 < PAPER_QUESTIONS ? 'Next Question' : 'Finish Paper'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {page === 'progress' && (
            <div className="progress-container">
              <h2>Your Progress</h2>

              {progress && (
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="label">Questions Solved</div>
                    <div className="value">{progress.questions_solved}</div>
                  </div>
                  <div className="stat-card">
                    <div className="label">Correct</div>
                    <div className="value">{progress.correct_answers}</div>
                  </div>
                  <div className="stat-card">
                    <div className="label">Accuracy</div>
                    <div className="value">
                      {progress.questions_solved > 0
                        ? Math.round((progress.correct_answers / progress.questions_solved) * 100)
                        : 0}%
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="label">Total Coins</div>
                    <div className="value">{progress.total_coins}</div>
                    <div className="coin-value-sub">{formatCoinValue(progress.total_coins)}</div>
                  </div>
                </div>
              )}

              {/* Badge shelf */}
              <div className="badge-shelf-card">
                <h3>🏅 Badges — {earnedBadges.length} / {BADGES.length}</h3>
                <div className="badge-shelf-grid">
                  {BADGES.map(b => {
                    const earned = earnedBadges.find(e => e.badge_id === b.id);
                    return (
                      <div
                        key={b.id}
                        className={`badge-shelf-item tier-${b.tier} ${earned ? 'earned' : 'locked'}`}
                        title={b.description}
                      >
                        <div className="badge-shelf-icon">{b.icon}</div>
                        <div className="badge-shelf-name">{b.name}</div>
                        <div className="badge-shelf-desc">{b.description}</div>
                        {earned && (
                          <div className="badge-shelf-date">
                            {new Date(earned.earned_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <TopicMasteryGrid mastery={topicMastery} onOpenTopic={goToTopic} />
              <DailyActivityTable activity={dailyActivity} />

              {/* 30-day score trend */}
              <div className="graph-card">
                <h3>Score Trend — Last 30 Days</h3>
                {pointsWithData.length === 0 ? (
                  <p className="graph-empty">Complete papers to see your trend here.</p>
                ) : (
                  <svg viewBox={`0 0 ${W} ${H}`} className="graph-svg">
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map(pct => {
                      const y = gpad.top + (1 - pct / 100) * innerH;
                      return (
                        <g key={pct}>
                          <line x1={gpad.left} y1={y} x2={W - gpad.right} y2={y} style={{ stroke: 'var(--border)' }} strokeWidth="1" />
                          <text x={gpad.left - 4} y={y + 4} fontSize="9" style={{ fill: 'var(--text-faint)' }} textAnchor="end">{pct}%</text>
                        </g>
                      );
                    })}
                    {/* X-axis labels */}
                    {graphData.map((d, i) => d.label ? (
                      <text
                        key={i}
                        x={gpad.left + (i / 29) * innerW}
                        y={H - 4}
                        fontSize="9"
                        style={{ fill: 'var(--text-faint)' }}
                        textAnchor="middle"
                      >{d.label}</text>
                    ) : null)}
                    {/* Line */}
                    {pointsWithData.length > 1 && (
                      <polyline points={polyline} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2" />
                    )}
                    {/* Dots */}
                    {pointsWithData.map((d) => {
                      const xi = graphData.indexOf(d);
                      const x = gpad.left + (xi / 29) * innerW;
                      const y = gpad.top + (1 - d.pct / 100) * innerH;
                      return (
                        <circle key={d.date} cx={x} cy={y} r="3" style={{ fill: 'var(--accent)' }}>
                          <title>{d.date}: {Math.round(d.pct)}% ({d.count} paper{d.count !== 1 ? 's' : ''})</title>
                        </circle>
                      );
                    })}
                  </svg>
                )}
              </div>

              {/* Paper history */}
              <div className="sessions-card">
                <h3>Paper History</h3>
                {sessions.length === 0 ? (
                  <p className="graph-empty">No papers completed yet.</p>
                ) : (
                  <table className="sessions-table">
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Level</th>
                        <th>Score</th>
                        <th>Time Taken</th>
                        <th>Coins</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map(s => {
                        const dt = new Date(s.completed_at);
                        const pct = Math.round((s.score / s.total_questions) * 100);
                        return (
                          <tr key={s.id}>
                            <td>{dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td><span className="badge-small">{difficultyLabel(s.difficulty)}</span></td>
                            <td>
                              <span className={`score-pill ${pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red'}`}>
                                {s.score}/{s.total_questions} ({pct}%)
                              </span>
                            </td>
                            <td>{formatTimeTaken(s.time_taken)}</td>
                            <td>💰 {s.coins_earned}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {page === 'learn' && (
            <div className="learn-container">
              {learnTopic ? (
                <TopicDetail
                  topic={TOPIC_MAP[learnTopic]}
                  onBack={() => setLearnTopic(null)}
                  isFavorite={favoriteTopics.includes(learnTopic)}
                  onToggleFavorite={() => toggleFavorite(learnTopic)}
                />
              ) : (
                <>
                  <h2>📘 Learn</h2>
                  <p className="learn-intro">Pick a topic to read a quick explanation with worked examples before you practise.</p>

                  <div className="learn-filters">
                    <input
                      type="text"
                      className="learn-search"
                      placeholder="🔍 Search topics…"
                      value={learnSearch}
                      onChange={(e) => setLearnSearch(e.target.value)}
                    />
                    <div className="learn-category-chips">
                      {['All', ...TOPIC_CATEGORIES].map(cat => (
                        <button
                          key={cat}
                          className={`learn-chip ${learnCategoryFilter === cat ? 'active' : ''}`}
                          onClick={() => setLearnCategoryFilter(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const search = learnSearch.trim().toLowerCase();
                    const matches = (t) =>
                      (learnCategoryFilter === 'All' || t.category === learnCategoryFilter) &&
                      (!search || t.title.toLowerCase().includes(search) || t.summary.toLowerCase().includes(search) || t.category.toLowerCase().includes(search));
                    const favorites = TOPICS.filter(t => favoriteTopics.includes(t.id) && matches(t));
                    const groups = TOPIC_CATEGORIES.map(cat => ({ cat, items: TOPICS.filter(t => t.category === cat && matches(t)) })).filter(g => g.items.length > 0);
                    const nothingFound = favorites.length === 0 && groups.length === 0;

                    const renderCard = (t) => (
                      <button key={t.id} className="topic-card" onClick={() => openTopic(t.id)}>
                        <button
                          className={`topic-favorite-star ${favoriteTopics.includes(t.id) ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(t.id); }}
                          title={favoriteTopics.includes(t.id) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          {favoriteTopics.includes(t.id) ? '⭐' : '☆'}
                        </button>
                        <div className="topic-card-icon">{t.icon}</div>
                        <div className="topic-card-title">{t.title}</div>
                        <div className="topic-card-summary">{t.summary}</div>
                      </button>
                    );

                    if (nothingFound) {
                      return <p className="graph-empty">No topics match your search.</p>;
                    }

                    return (
                      <>
                        {favorites.length > 0 && (
                          <div className="topic-category-group">
                            <h3>⭐ Favorites</h3>
                            <div className="topic-grid">{favorites.map(renderCard)}</div>
                          </div>
                        )}
                        {groups.map(({ cat, items }) => (
                          <div key={cat} className="topic-category-group">
                            <h3>{cat}</h3>
                            <div className="topic-grid">{items.map(renderCard)}</div>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {page === 'formulas' && (
            <div className="learn-container">
              <h2>📐 Formula Reference</h2>
              <p className="learn-intro">The key formula to master for each topic — a quick lookup while you're learning or practising.</p>

              <div className="learn-filters">
                <input
                  type="text"
                  className="learn-search"
                  placeholder="🔍 Search formulas…"
                  value={formulaSearch}
                  onChange={(e) => setFormulaSearch(e.target.value)}
                />
                <div className="learn-category-chips">
                  {['All', ...TOPIC_CATEGORIES].map(cat => (
                    <button
                      key={cat}
                      className={`learn-chip ${formulaCategoryFilter === cat ? 'active' : ''}`}
                      onClick={() => setFormulaCategoryFilter(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const search = formulaSearch.trim().toLowerCase();
                const matches = (t) => {
                  if (formulaCategoryFilter !== 'All' && t.category !== formulaCategoryFilter) return false;
                  if (!search) return true;
                  if (t.title.toLowerCase().includes(search) || t.category.toLowerCase().includes(search)) return true;
                  return (FORMULAS[t.id] || []).some(f =>
                    f.name.toLowerCase().includes(search) || f.expression.toLowerCase().includes(search)
                  );
                };
                const groups = TOPIC_CATEGORIES.map(cat => ({ cat, items: TOPICS.filter(t => t.category === cat && matches(t)) })).filter(g => g.items.length > 0);

                if (groups.length === 0) {
                  return <p className="graph-empty">No formulas match your search.</p>;
                }

                return groups.map(({ cat, items }) => (
                  <div key={cat} className="topic-category-group">
                    <h3>{cat}</h3>
                    <div className="formula-grid">
                      {items.map(t => (
                        <div key={t.id} className="formula-card">
                          <div className="formula-card-header">
                            <span className="formula-card-icon">{t.icon}</span>
                            <span className="formula-card-title">{t.title}</span>
                          </div>
                          {(FORMULAS[t.id] || []).map((f, i) => (
                            <div key={i} className="formula-callout-item">
                              <span className="formula-callout-name">{f.name}</span>
                              <span className="formula-callout-expression">{f.expression}</span>
                              {f.note && <span className="formula-callout-note">{f.note}</span>}
                            </div>
                          ))}
                          <button className="formula-card-link" onClick={() => goToTopic(t.id)}>
                            View full lesson →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Parent Dashboard
  const child = selectedChild;
  const childProgress = child?.progress;
  const childSessions = child?.sessions || [];

  return (
    <div className="app">
      {!isOnline && (
        <div className="offline-banner">
          ⚠️ You're offline — showing the last data loaded. Reconnect to see up-to-date progress.
        </div>
      )}
      <header className="header">
        <h1>📚 Parent Dashboard</h1>
        <div className="user-info">
          <span>{currentUser.name}</span>
          <button onClick={() => setCurrentUser(null)}>Logout</button>
        </div>
      </header>

      <div className="content">
        <div className="parent-dashboard">

          {/* Coin economy settings */}
          <div className="coin-settings-section">
            <h3>🪙 Coin Settings</h3>
            <p className="coin-settings-hint">
              Configure how coins are earned and lost, and their real-world value.
            </p>
            {coinSettingsDraft && (
              <>
                <div className="coin-settings-grid">
                  <label>
                    Easy — correct answer (+coins)
                    <input
                      type="number"
                      min="0"
                      value={coinSettingsDraft.easy_coins}
                      onChange={(e) => setCoinSettingsDraft({ ...coinSettingsDraft, easy_coins: e.target.value })}
                    />
                  </label>
                  <label>
                    Medium — correct answer (+coins)
                    <input
                      type="number"
                      min="0"
                      value={coinSettingsDraft.medium_coins}
                      onChange={(e) => setCoinSettingsDraft({ ...coinSettingsDraft, medium_coins: e.target.value })}
                    />
                  </label>
                  <label>
                    Hard — correct answer (+coins)
                    <input
                      type="number"
                      min="0"
                      value={coinSettingsDraft.hard_coins}
                      onChange={(e) => setCoinSettingsDraft({ ...coinSettingsDraft, hard_coins: e.target.value })}
                    />
                  </label>
                  <label>
                    Wrong answer (−coins)
                    <input
                      type="number"
                      min="0"
                      value={coinSettingsDraft.wrong_coins}
                      onChange={(e) => setCoinSettingsDraft({ ...coinSettingsDraft, wrong_coins: e.target.value })}
                    />
                  </label>
                  <label>
                    Skipped question (−coins)
                    <input
                      type="number"
                      min="0"
                      value={coinSettingsDraft.skip_coins}
                      onChange={(e) => setCoinSettingsDraft({ ...coinSettingsDraft, skip_coins: e.target.value })}
                    />
                  </label>
                  <label>
                    Coins per penny
                    <input
                      type="number"
                      min="1"
                      value={coinSettingsDraft.coins_per_penny}
                      onChange={(e) => setCoinSettingsDraft({ ...coinSettingsDraft, coins_per_penny: e.target.value })}
                    />
                  </label>
                </div>
                <p className="coin-settings-rate">
                  Currently: {coinSettingsDraft.coins_per_penny} coins = 1p
                </p>
                <button
                  className="btn-primary"
                  onClick={handleSaveCoinSettings}
                  disabled={coinSettingsStatus === 'saving'}
                >
                  {coinSettingsStatus === 'saving' ? 'Saving…' : 'Save Coin Settings'}
                </button>
                {coinSettingsStatus === 'saved' && <p className="upload-msg success">✓ Coin settings updated!</p>}
                {coinSettingsStatus === 'error' && <p className="upload-msg error">Could not save coin settings.</p>}
              </>
            )}
          </div>

          {/* Link a child */}
          <div className="link-child-section">
            <h3>Link a Child Account</h3>
            <div className="link-child-row">
              <input
                type="text"
                placeholder="Child's username"
                value={linkUsername}
                onChange={(e) => { setLinkUsername(e.target.value); setLinkStatus(null); }}
                onKeyPress={(e) => e.key === 'Enter' && handleLinkChild()}
              />
              <button
                className="btn-primary"
                onClick={handleLinkChild}
                disabled={linkStatus === 'linking'}
              >
                {linkStatus === 'linking' ? 'Linking…' : 'Link Child'}
              </button>
            </div>
            {linkStatus === 'ok' && <p className="upload-msg success">✓ Child linked successfully!</p>}
            {linkStatus?.error && <p className="upload-msg error">{linkStatus.error}</p>}
          </div>

          {/* Linked children tabs */}
          {children.length > 0 && (
            <>
              <div className="child-tabs">
                {children.map(c => (
                  <div key={c.id} className={`child-tab ${selectedChild?.id === c.id ? 'active' : ''}`}>
                    <button onClick={() => setSelectedChild(c)}>{c.name}</button>
                    <span
                      className="unlink-btn"
                      onClick={() => handleUnlinkChild(c.id)}
                      title="Unlink this child"
                    >✕</span>
                  </div>
                ))}
              </div>

              {child && (
                <div className="child-report">
                  <div className="child-report-header">
                    <h2>{child.name}'s Progress <span className="username-tag">@{child.username}</span></h2>
                    <button className="btn-quit" onClick={() => handleResetCoins(child.id)}>↺ Reset Coins</button>
                  </div>

                  {childProgress ? (
                    <div className="stats-grid">
                      <div className="stat-card">
                        <div className="label">Questions Solved</div>
                        <div className="value">{childProgress.questions_solved}</div>
                      </div>
                      <div className="stat-card">
                        <div className="label">Correct</div>
                        <div className="value">{childProgress.correct_answers}</div>
                      </div>
                      <div className="stat-card">
                        <div className="label">Accuracy</div>
                        <div className="value">
                          {childProgress.questions_solved > 0
                            ? Math.round((childProgress.correct_answers / childProgress.questions_solved) * 100)
                            : 0}%
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="label">Total Coins</div>
                        <div className="value">💰 {childProgress.total_coins}</div>
                        <div className="coin-value-sub">{formatCoinValue(childProgress.total_coins)}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="graph-empty">No progress recorded yet.</p>
                  )}

                  <TopicMasteryGrid mastery={child.mastery} />
                  <DailyActivityTable activity={child.dailyActivity} />

                  <div className="sessions-card">
                    <h3>Recent Papers</h3>
                    {childSessions.length === 0 ? (
                      <p className="graph-empty">No papers completed yet.</p>
                    ) : (
                      <table className="sessions-table">
                        <thead>
                          <tr>
                            <th>Date &amp; Time</th>
                            <th>Level</th>
                            <th>Score</th>
                            <th>Time Taken</th>
                            <th>Coins</th>
                          </tr>
                        </thead>
                        <tbody>
                          {childSessions.map(s => {
                            const dt = new Date(s.completed_at);
                            const pct = Math.round((s.score / s.total_questions) * 100);
                            return (
                              <tr key={s.id}>
                                <td>{dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td><span className="badge-small">{difficultyLabel(s.difficulty)}</span></td>
                                <td>
                                  <span className={`score-pill ${pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red'}`}>
                                    {s.score}/{s.total_questions} ({pct}%)
                                  </span>
                                </td>
                                <td>{formatTimeTaken(s.time_taken)}</td>
                                <td>💰 {s.coins_earned}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="sessions-card">
                    <h3>Recent Answers — Coin Log</h3>
                    {(!child.answerLog || child.answerLog.length === 0) ? (
                      <p className="graph-empty">No answers recorded yet.</p>
                    ) : (
                      <table className="sessions-table">
                        <thead>
                          <tr>
                            <th>Date &amp; Time</th>
                            <th>Question</th>
                            <th>Outcome</th>
                            <th>Coins</th>
                          </tr>
                        </thead>
                        <tbody>
                          {child.answerLog.map(a => {
                            const dt = new Date(a.created_at);
                            const outcomeLabel = a.outcome === 'correct' ? 'Correct' : a.outcome === 'skipped' ? 'Skipped' : 'Incorrect';
                            const pillClass = a.outcome === 'correct' ? 'green' : a.outcome === 'skipped' ? 'amber' : 'red';
                            return (
                              <tr key={a.id}>
                                <td>{dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="answer-log-question">{a.question_text}</td>
                                <td><span className={`score-pill ${pillClass}`}>{outcomeLabel}</span></td>
                                <td>{a.coins_delta > 0 ? '+' : ''}{a.coins_delta}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {children.length === 0 && (
            <p className="graph-empty" style={{ marginTop: '1rem' }}>
              No children linked yet. Enter your child's username above to get started.
            </p>
          )}

          {/* Upload past papers */}
          <div className="upload-section">
            <h3>Upload Past Papers</h3>
            <label className="file-label">
              {uploadFile ? uploadFile.name : 'Choose PDF file…'}
              <input
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={(e) => { setUploadFile(e.target.files[0] || null); setUploadStatus(null); }}
              />
            </label>
            <input
              type="text"
              placeholder="Paper name (e.g. JMC 2024)"
              value={uploadName}
              onChange={(e) => { setUploadName(e.target.value); setUploadStatus(null); }}
            />
            <button
              className="btn-primary"
              onClick={handleUploadPaper}
              disabled={uploadStatus === 'uploading'}
            >
              {uploadStatus === 'uploading' ? 'Uploading…' : 'Upload Paper'}
            </button>
            {uploadStatus === 'success' && <p className="upload-msg success">✓ Paper uploaded successfully!</p>}
            {uploadStatus === 'error' && (
              <p className="upload-msg error">
                {!uploadFile ? 'Please select a PDF file.' : !uploadName.trim() ? 'Please enter a paper name.' : 'Upload failed. Please try again.'}
              </p>
            )}
          </div>

          {uploadedPapers.length > 0 && (
            <div className="uploaded-papers">
              <h3>Uploaded Papers</h3>
              <ul>
                {uploadedPapers.map(p => (
                  <li key={p.id}>
                    <span className="paper-name">{p.paper_name}</span>
                    <span className="paper-file">{p.filename}</span>
                    <span className="paper-date">{new Date(p.created_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
