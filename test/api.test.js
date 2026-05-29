import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import server from '../server.js';

const { createApp } = server;

// A fake pg pool. Tests assign `route = (sqlText, params) => result | null`.
// Returning null falls through to an empty result set; throwing rejects the
// query (mimicking a constraint violation / connection error).
let route = () => null;

function makePool() {
  const query = (text, params, cb) => {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    let result;
    let error;
    try {
      result = route(text, params) ?? { rows: [] };
    } catch (e) {
      error = e;
    }
    if (typeof cb === 'function') {
      cb(error, error ? undefined : result);
      return undefined;
    }
    return error ? Promise.reject(error) : Promise.resolve(result);
  };
  return { query };
}

let app;

beforeEach(() => {
  route = () => null; // schema init + seeding see empty results, which is fine
  app = createApp(makePool());
});

describe('POST /api/auth/login', () => {
  it('returns the user and progress for valid credentials', async () => {
    route = (text) => {
      if (/FROM users WHERE username/.test(text)) {
        return { rows: [{ id: 1, username: 'child', name: 'Child', type: 'child', total_coins: 0 }] };
      }
      if (/FROM user_progress WHERE user_id/.test(text)) {
        return { rows: [{ user_id: 1, questions_solved: 3 }] };
      }
      return null;
    };

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'child', password: 'child123' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('child');
    expect(res.body.type).toBe('child');
    expect(res.body.progress).toEqual({ user_id: 1, questions_solved: 3 });
  });

  it('returns 401 for invalid credentials (regression)', async () => {
    route = () => ({ rows: [] }); // no matching user row

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'child', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });
});

describe('POST /api/auth/register', () => {
  it('returns 400 when the username already exists', async () => {
    route = (text) => {
      if (/INSERT INTO users/.test(text)) {
        throw new Error('duplicate key value violates unique constraint');
      }
      return null;
    };

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'child', password: 'x', name: 'C', type: 'child' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duplicate key/);
  });
});

describe('POST /api/progress/update', () => {
  it('awards the correct number of coins for a correct year8 answer', async () => {
    let updateParams;
    route = (text, params) => {
      if (/UPDATE user_progress/.test(text)) {
        updateParams = params; // [user_id, correctIncrement, coinsEarned]
        return { rows: [{ user_id: 1, total_coins: params[2] }] };
      }
      return null; // daily_history upsert -> empty result
    };

    const res = await request(app)
      .post('/api/progress/update')
      .send({ user_id: 1, correct: true, difficulty: 'year8' });

    expect(res.status).toBe(200);
    expect(updateParams[1]).toBe(1); // correct answer increments correct_answers
    expect(updateParams[2]).toBe(15); // year8 = 15 coins
    expect(res.body.total_coins).toBe(15);
  });

  it('awards zero coins for an incorrect answer', async () => {
    let updateParams;
    route = (text, params) => {
      if (/UPDATE user_progress/.test(text)) {
        updateParams = params;
        return { rows: [{ user_id: 1, total_coins: 0 }] };
      }
      return null;
    };

    const res = await request(app)
      .post('/api/progress/update')
      .send({ user_id: 1, correct: false, difficulty: 'year9' });

    expect(res.status).toBe(200);
    expect(updateParams[1]).toBe(0);
    expect(updateParams[2]).toBe(0);
  });
});

describe('GET /api/questions/:difficulty', () => {
  it('returns a question for the difficulty', async () => {
    route = (text) => {
      if (/FROM questions WHERE difficulty/.test(text)) {
        return { rows: [{ id: 7, difficulty: 'year6', text: 'What is 2+2?', answer: '4' }] };
      }
      return null;
    };

    const res = await request(app).get('/api/questions/year6');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(7);
    expect(res.body.text).toBe('What is 2+2?');
  });

  it('returns null when the bank has no question for the difficulty', async () => {
    route = () => ({ rows: [] });

    const res = await request(app).get('/api/questions/year99');

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});
