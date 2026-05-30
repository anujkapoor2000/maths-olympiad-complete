import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || '';
const PAPER_QUESTIONS = 15;
const PAPER_TIME = 30 * 60; // 30 minutes in seconds

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState('login');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [difficulty, setDifficulty] = useState('year6');
  const [progress, setProgress] = useState(null);

  // Paper-level state
  const [paperActive, setPaperActive] = useState(false);
  const [paperComplete, setPaperComplete] = useState(false);
  const [paperTimeRemaining, setPaperTimeRemaining] = useState(PAPER_TIME);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [paperResults, setPaperResults] = useState([]);

  // Per-question state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [result, setResult] = useState(null);

  const loadQuestion = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/questions/${difficulty}`);
      setCurrentQuestion(response.data);
      setAnswered(false);
      setUserAnswer('');
      setResult(null);
    } catch (err) {
      console.error('Error loading question:', err);
    }
  };

  const startPaper = async () => {
    setPaperTimeRemaining(PAPER_TIME);
    setPaperActive(true);
    setPaperComplete(false);
    setQuestionIndex(0);
    setPaperResults([]);
    try {
      const response = await axios.get(`${API_URL}/api/questions/${difficulty}`);
      setCurrentQuestion(response.data);
      setAnswered(false);
      setUserAnswer('');
      setResult(null);
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
    } catch (err) {
      alert('Login failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || answered) return;
    const expected = (currentQuestion.answer ?? '').toString().toLowerCase().trim();
    const correct = userAnswer.toLowerCase().trim() === expected;
    try {
      await axios.post(`${API_URL}/api/progress/update`, {
        user_id: currentUser.id,
        correct,
        difficulty
      });
      setResult({ correct, expected: currentQuestion.answer });
      setAnswered(true);
      setPaperResults(prev => [...prev, { correct }]);
      const progressResponse = await axios.get(`${API_URL}/api/progress/${currentUser.id}`);
      setProgress(progressResponse.data.progress);
    } catch (err) {
      console.error('Error submitting answer:', err);
    }
  };

  const handleNextQuestion = () => {
    const nextIndex = questionIndex + 1;
    if (nextIndex >= PAPER_QUESTIONS) {
      setPaperActive(false);
      setPaperComplete(true);
      setCurrentQuestion(null);
    } else {
      setQuestionIndex(nextIndex);
      loadQuestion();
    }
  };

  // Paper-level countdown timer — shared across all questions
  useEffect(() => {
    if (!paperActive) return;
    const interval = setInterval(() => {
      setPaperTimeRemaining(t => {
        if (t <= 1) {
          setPaperActive(false);
          setPaperComplete(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [paperActive]);

  const demoLogin = (username, password) => {
    setLoginForm({ username, password });
    handleLogin(null, { username, password });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    const timerWarning = paperTimeRemaining < 300;
    const correctCount = paperResults.filter(r => r.correct).length;

    return (
      <div className="app">
        {/* Fixed top-right paper timer — visible while paper is active */}
        {paperActive && (
          <div className={`paper-timer${timerWarning ? ' warning' : ''}`}>
            <div className="paper-timer-label">Time Left</div>
            <div className="paper-timer-value">{formatTime(paperTimeRemaining)}</div>
          </div>
        )}

        <header className="header">
          <h1>📚 Maths Olympiad</h1>
          <div className="user-info">
            <span>{currentUser.name}</span>
            <span>💰 {progress?.total_coins || 0}</span>
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

              {/* Year selector — only shown on start screen */}
              {!paperActive && !paperComplete && (
                <div className="difficulty-selector">
                  <label>Year Level:</label>
                  {['year6', 'year7', 'year8'].map(y => (
                    <label key={y}>
                      <input
                        type="radio"
                        value={y}
                        checked={difficulty === y}
                        onChange={(e) => setDifficulty(e.target.value)}
                      />
                      {y.replace('year', 'Year ')}
                    </label>
                  ))}
                </div>
              )}

              {/* Start screen */}
              {!paperActive && !paperComplete && (
                <div className="paper-start">
                  <h2>Ready for a challenge?</h2>
                  <p>{PAPER_QUESTIONS} questions &middot; 30 minutes &middot; {difficulty.replace('year', 'Year ')}</p>
                  <button className="btn-primary" onClick={startPaper}>Start Paper</button>
                </div>
              )}

              {/* Paper complete screen */}
              {paperComplete && (
                <div className="paper-complete">
                  <h2>Paper Complete!</h2>
                  <div className="paper-score">{correctCount} / {paperResults.length}</div>
                  <p className="score-message">
                    {correctCount >= 12 ? '🌟 Excellent!' :
                     correctCount >= 8  ? '👍 Good work!' :
                                          '💪 Keep practising!'}
                  </p>
                  {paperTimeRemaining === 0 && (
                    <p className="time-up">Time ran out!</p>
                  )}
                  <button
                    className="btn-primary"
                    onClick={() => { setPaperComplete(false); setCurrentQuestion(null); }}
                  >
                    Start New Paper
                  </button>
                </div>
              )}

              {/* Active question */}
              {paperActive && currentQuestion && (
                <div className="question-card">
                  <div className="question-header">
                    <span className="badge">{difficulty.replace('year', 'Year ')}</span>
                    <span className="question-counter">
                      Question {questionIndex + 1} of {PAPER_QUESTIONS}
                    </span>
                  </div>
                  <h2>{currentQuestion.text}</h2>

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
                          ? '✓ Correct! +10 coins'
                          : `✗ Incorrect — answer: ${result.expected}`}
                      </div>
                      <div className="solution">
                        <h3>Solution</h3>
                        <p>{currentQuestion.solution}</p>
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

          {page === 'progress' && progress && (
            <div className="progress-container">
              <h2>Your Progress</h2>
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
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Parent Dashboard
  return (
    <div className="app">
      <header className="header">
        <h1>📚 Parent Dashboard</h1>
        <button onClick={() => setCurrentUser(null)}>Logout</button>
      </header>

      <div className="content">
        <div className="parent-dashboard">
          <h2>Child's Progress</h2>

          <div className="upload-section">
            <h3>Upload Past Papers</h3>
            <input type="file" accept=".pdf" />
            <input type="text" placeholder="Paper Name" />
            <button className="btn-primary">Upload Paper</button>
          </div>

          {progress && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="label">This Week</div>
                <div className="value">{progress.questions_solved}</div>
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
                <div className="label">Coins Earned</div>
                <div className="value">{progress.total_coins}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
