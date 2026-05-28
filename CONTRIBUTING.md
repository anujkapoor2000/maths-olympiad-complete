# Contributing to Maths Olympiad Prep

Thank you for your interest in contributing! Here's how you can help.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/maths-olympiad.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `npm install`

## Development Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your Neon database URL and API keys
nano .env.local

# Install dependencies
npm install

# Start development server
npm run dev
```

Server runs on `http://localhost:3000`

## Code Style

- Use 2-space indentation
- Use camelCase for variables and functions
- Add comments for complex logic
- Keep functions focused and small

## Making Changes

### For Backend Changes
- Modify `server.js`
- Test API endpoints with curl or Postman
- Update database schema if needed in `seed.sql`

### For Frontend Changes
- Modify `public/App.jsx`
- Update styling in `public/App.css`
- Test in browser

### For Questions
- Edit `seed.sql` to add/modify questions
- Follow existing format
- Include solution with each question
- Test with different difficulty levels

## Testing Your Changes

Before submitting a PR:
- [ ] Test login with both child and parent accounts
- [ ] Verify questions load randomly
- [ ] Check progress saves to database
- [ ] Test on mobile (responsive design)
- [ ] No console errors

## Committing Changes

```bash
# Stage changes
git add .

# Commit with clear message
git commit -m "feat: Add 10 more Year 9 algebra questions"

# Push to your fork
git push origin feature/your-feature-name
```

### Commit Message Format
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation
- `style:` for formatting
- `refactor:` for code improvements
- `test:` for tests

## Submitting a Pull Request

1. Go to GitHub and create a Pull Request
2. Describe what you changed and why
3. Reference any related issues (#123)
4. Wait for review and address feedback

## What We're Looking For

### High Priority
- [ ] Bug fixes
- [ ] New curriculum-aligned questions
- [ ] Performance improvements
- [ ] Documentation improvements
- [ ] Security enhancements

### Good to Have
- [ ] New features (check with maintainers first)
- [ ] Design improvements
- [ ] Accessibility enhancements
- [ ] Internationalization (translations)

### Adding Questions

To contribute questions:

1. Research curriculum standards for the year level
2. Create age-appropriate questions
3. Include detailed solutions
4. Test with target age group
5. Format in seed.sql:

```sql
INSERT INTO questions (difficulty, type, text, answer, solution, source) 
VALUES ('year7', 'shortAnswer', 'Your question here?', 'expected answer', 
  'Step 1: explanation\nStep 2: more explanation', 'YourName');
```

## Reporting Issues

Found a bug? Create an issue with:
- Clear title
- Description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if relevant

## Questions?

- Check existing issues first
- Ask in discussions
- Email the maintainers

## License

By contributing, you agree your work will be licensed under MIT.

Thank you for contributing! 🎓
