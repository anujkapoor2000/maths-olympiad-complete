// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import App from '../src/App.jsx';

// axios is mocked so the component never makes real network calls.
vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('alert', vi.fn());
});

describe('login screen', () => {
  it('renders the login form and demo account buttons', () => {
    render(<App />);
    expect(screen.getByText('📚 Maths Olympiad Prep')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByText(/Child \(child\/child123\)/)).toBeInTheDocument();
  });

  it('demo login posts the explicit credentials and routes a child to the challenge', async () => {
    axios.post.mockResolvedValue({
      data: { id: 1, name: 'Child', type: 'child', progress: { total_coins: 5 } },
    });

    render(<App />);
    fireEvent.click(screen.getByText(/Child \(child\/child123\)/));

    await waitFor(() => expect(screen.getByText('Start Challenge')).toBeInTheDocument());
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      { username: 'child', password: 'child123' },
    );
  });

  it('routes a parent to the parent dashboard', async () => {
    axios.post.mockResolvedValue({
      data: { id: 2, name: 'Parent 1', type: 'parent', progress: { total_coins: 0 } },
    });

    render(<App />);
    fireEvent.click(screen.getByText(/Parent 1 \(parent1\/parent123\)/));

    await waitFor(() => expect(screen.getByText('📚 Parent Dashboard')).toBeInTheDocument());
    expect(screen.getByText('Upload Past Papers')).toBeInTheDocument();
  });

  it('alerts when login fails', async () => {
    axios.post.mockRejectedValue({ response: { data: { error: 'Invalid credentials' } } });

    render(<App />);
    fireEvent.click(screen.getByText(/Child \(child\/child123\)/));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Invalid credentials')),
    );
  });
});

describe('challenge flow', () => {
  async function loginAsChild() {
    axios.post.mockImplementation((url) => {
      if (url.includes('/api/auth/login')) {
        return Promise.resolve({
          data: { id: 1, name: 'Child', type: 'child', progress: { total_coins: 0 } },
        });
      }
      if (url.includes('/api/progress/update')) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });

    render(<App />);
    fireEvent.click(screen.getByText(/Child \(child\/child123\)/));
    await waitFor(() => expect(screen.getByText('Start Challenge')).toBeInTheDocument());
  }

  it('loads a free-text question, accepts a correct answer, and shows the solution', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/questions/')) {
        return Promise.resolve({
          data: { id: 1, text: 'What is 2+2?', answer: '4', solution: '2 + 2 = 4', options: null },
        });
      }
      if (url.includes('/api/progress/')) {
        return Promise.resolve({
          data: { progress: { total_coins: 10, questions_solved: 1, correct_answers: 1 } },
        });
      }
      return Promise.resolve({ data: {} });
    });

    await loginAsChild();
    fireEvent.click(screen.getByText('Start Challenge'));

    await waitFor(() => expect(screen.getByText('What is 2+2?')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Enter your answer...'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByText('Submit Answer'));

    await waitFor(() => expect(screen.getByText(/Correct!/)).toBeInTheDocument());
    expect(screen.getByText('2 + 2 = 4')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/progress/update'),
      expect.objectContaining({ user_id: 1, correct: true, difficulty: 'year6' }),
    );
  });

  it('marks an incorrect answer and still shows the solution', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/questions/')) {
        return Promise.resolve({
          data: { id: 1, text: 'What is 2+2?', answer: '4', solution: '2 + 2 = 4', options: null },
        });
      }
      return Promise.resolve({ data: { progress: {} } });
    });

    await loginAsChild();
    fireEvent.click(screen.getByText('Start Challenge'));
    await waitFor(() => expect(screen.getByText('What is 2+2?')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Enter your answer...'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByText('Submit Answer'));

    await waitFor(() => expect(screen.getByText(/Incorrect/)).toBeInTheDocument());
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/progress/update'),
      expect.objectContaining({ correct: false }),
    );
  });

  it('renders multiple-choice options as buttons instead of a text input', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/questions/')) {
        return Promise.resolve({
          data: {
            id: 2,
            text: 'Pick one',
            answer: '20',
            solution: '...',
            options: '["10","20","30"]',
          },
        });
      }
      return Promise.resolve({ data: { progress: {} } });
    });

    await loginAsChild();
    fireEvent.click(screen.getByText('Start Challenge'));
    await waitFor(() => expect(screen.getByText('Pick one')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Enter your answer...')).not.toBeInTheDocument();
  });
});
