import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import { formatTime, parseOptions, gradeAnswer } from './utils';

// In production the API is served from the same origin (Vercel rewrites /api/* to the
// serverless function). In local dev the Vite proxy forwards /api to the Express server.
const API_URL = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState('login');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [difficulty, setDifficulty] = useState('year6');
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [answered, setAnswered] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null);

  // Load question
  const loadQuestion = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/questions/${difficulty}`);
      setCurrentQuestion(response.data);
      setAnswered(false);
      setUserAnswer('');
      setResult(null);
      startTimer();
    } catch (err) {
      console.error('Error loading question:', err);
    }
  };

  // Start timer
  const startTimer = () => {
    setTimerRunning(true);
    setTimeRemaining(300);
  };

  // Handle login. Accepts optional explicit credentials (used by the demo buttons)
  // so we never depend on not-yet-flushed loginForm state.
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

  // Submit answer
  const handleSubmitAnswer = async () => {
    if (!currentQuestion || answered) return;

    const correct = gradeAnswer(userAnswer, currentQuestion.answer);

    try {
      await axios.post(`${API_URL}/api/progress/update`, {
        user_id: currentUser.id,
        correct,
        difficulty
      });

      setResult({ correct, expected: currentQuestion.answer });
      setAnswered(true);
      setTimerRunning(false);

      // Reload progress
      const progressResponse = await axios.get(`${API_URL}/api/progress/${currentUser.id}`);
      setProgress(progressResponse.data.progress);
    } catch (err) {
      console.error('Error submitting answer:', err);
    }
  };

  // Timer effect
  useEffect(() => {
    if (!timerRunning) return;

    const interval = setInterval(() => {
      setTimeRemaining(t => {
        if (t <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning]);

  // Demo accounts: fill the form and submit immediately with explicit credentials.
  const demoLogin = (username, password) => {
    setLoginForm({ username, password });
    handleLogin(null, { username, password });
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
            <button
              className="demo-btn"
              onClick={() => demoLogin('child', 'child123')}
            >
              👦 Child (child/child123)
            </button>
            <button
              className="demo-btn"
              onClick={() => demoLogin('parent1', 'parent123')}
            >
              👨 Parent 1 (parent1/parent123)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser.type === 'child') {
    return (
      <div className="app">
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
              <div className="difficulty-selector">
                <label>Year Level:</label>
                {['year6', 'year7', 'year8', 'year9'].map(y => (
                  <label key={y}>
                    <input 
                      type="radio" 
                      value={y} 
                      checked={difficulty === y}
                      onChange={(e) => setDifficulty(e.target.value)}
                      disabled={timerRunning}
                    />
                    {y.toUpperCase()}
                  </label>
                ))}
              </div>

              {!currentQuestion ? (
                <button className="btn-primary" onClick={loadQuestion}>
                  Start Challenge
                </button>
              ) : (
                <>
                  <div className="question-card">
                    <span className="badge">{difficulty}</span>
                    <h2>{currentQuestion.text}</h2>

                    <div className="timer">
                      <div className="timer-circle">{formatTime(timeRemaining)}</div>
                      <div>Time Left</div>
                    </div>

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
                          {result.correct ? '✓ Correct!' : '✗ Incorrect'}
                          {result.correct ? ' +10 coins' : ' Review below'}
                        </div>
                        <div className="solution">
                          <h3>Solution</h3>
                          <p>{currentQuestion.solution}</p>
                        </div>
                        <button className="btn-primary" onClick={loadQuestion}>
                          Next Question
                        </button>
                      </>
                    )}
                  </div>
                </>
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
