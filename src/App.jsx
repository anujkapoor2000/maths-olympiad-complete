import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || '';
const PAPER_QUESTIONS = 15;
// Per-question timer, in seconds, by difficulty tier.
const QUESTION_TIME_BY_LEVEL = { easy: 60, medium: 90, hard: 135 };
const getQuestionTime = (lv) => QUESTION_TIME_BY_LEVEL[lv] || QUESTION_TIME_BY_LEVEL.medium;

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState('login');
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

  useEffect(() => {
    axios.get(`${API_URL}/api/settings/coins`).then(r => {
      setCoinSettings(r.data);
      setCoinSettingsDraft(r.data);
    }).catch(() => {});
  }, []);

  const flashCoinToast = (delta) => {
    if (coinToastTimeout.current) clearTimeout(coinToastTimeout.current);
    setCoinToast({ delta });
    coinToastTimeout.current = setTimeout(() => setCoinToast(null), 1800);
  };

  const formatCoinValue = (coins) => {
    const perPenny = coinSettings.coins_per_penny || 10;
    return `£${(coins / perPenny / 100).toFixed(2)}`;
  };

  const loadQuestion = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/questions/${difficulty}`, { params: { level } });
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
    try {
      const response = await axios.get(`${API_URL}/api/questions/${difficulty}`, { params: { level } });
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
        question_level: currentQuestion.level
      });
      const coinsDelta = response.data.coinsDelta ?? 0;
      setResult({ correct, expected: currentQuestion.answer, coinsDelta });
      setAnswered(true);
      setPaperResults(prev => [...prev, { correct, subject: currentQuestion.subject, coinsDelta }]);
      flashCoinToast(coinsDelta);
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
      await axios.post(`${API_URL}/api/papers/complete`, {
        user_id: currentUser.id,
        difficulty,
        score: correctCount,
        total_questions: results.length,
        time_taken: timeTaken,
        coins_earned: coinsEarned
      });
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
      const progressResponse = await axios.get(`${API_URL}/api/progress/${currentUser.id}`);
      setProgress(progressResponse.data.progress);
      setSessions(progressResponse.data.sessions || []);
    } catch (err) {
      console.error('Error recording skipped question:', err);
    }
    const newResults = [...paperResults, { correct: false, subject: currentQuestion.subject, skipped: true, coinsDelta }];
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
