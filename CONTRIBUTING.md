# Contributing to Land Cover Validation System

Thank you for considering contributing to this project! 🎉

## Code of Conduct

This project follows a standard code of conduct. Please be respectful and constructive in all interactions.

## How to Contribute

### Reporting Bugs

1. **Check existing issues** - Someone may have already reported it
2. **Use the bug template** - Fill in all required information
3. **Include**:
   - System info (OS, Node version, Docker version)
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Relevant logs

### Suggesting Enhancements

1. **Search existing suggestions** first
2. **Use the feature request template**
3. **Provide**:
   - Clear use case
   - Proposed solution
   - Alternative approaches considered
   - Impact on existing functionality

### Pull Requests

#### Before You Start

1. **Discuss major changes** in an issue first
2. **Check** that no one else is working on it
3. **Fork** the repository

#### Development Workflow

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/Land-cover-validation.git
cd Land-cover-validation

# 2. Create a branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description

# 3. Install dependencies
npm install

# 4. Make your changes
# ... code ...

# 5. Test thoroughly
npm test  # if tests exist
npm start # manual testing

# 6. Commit with conventional commits
git commit -m "feat: add country filter to exports"
git commit -m "fix: resolve photo upload timeout issue"

# 7. Push and create PR
git push origin feature/your-feature-name
```

#### Commit Message Convention

We use **Conventional Commits**:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Code style (formatting, no logic change)
- `refactor:` Code refactoring
- `perf:` Performance improvement
- `test:` Adding tests
- `chore:` Build process, dependencies

**Examples:**
```
feat(dashboard): add bulk validation feature
fix(n8n): handle missing photo attachments gracefully
docs(api): document photo upload endpoint
refactor(server): extract validation logic to separate module
```

#### Pull Request Guidelines

**Title:** Follow conventional commit format
```
feat: add country filter to validation dashboard
```

**Description:**
- Explain **what** and **why** (not how - code shows that)
- Reference related issues (`Fixes #123`, `Closes #456`)
- Include screenshots for UI changes
- List breaking changes (if any)

**Checklist:**
- [ ] Code follows project style
- [ ] Tested locally
- [ ] Documentation updated
- [ ] No sensitive data in commits
- [ ] Commits are clear and atomic

## Code Style

### JavaScript/Node.js

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Line length**: 120 characters max
- **Naming**:
  - Variables: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Functions: `camelCase`
  - Classes: `PascalCase`

**Example:**
```javascript
const BATCH_SIZE = 50;

function processRecords(records) {
  const validRecords = records.filter(r => r.uuid);
  return validRecords.map(transformRecord);
}
```

### EJS Templates

- **Indentation**: 2 spaces
- **Use partials** for reusable components
- **Escape user input** with `<%= %>` (not `<%- %>`)
- **Comment complex logic**

### CSS/Tailwind

- **Prefer Tailwind classes** over custom CSS
- **Order**: Layout → Display → Spacing → Colors → Typography
- **Extract repeated patterns** into components

## Project Structure

```
Land-cover-validation/
├── server.js              # Main Express server
├── views/                 # EJS templates
│   ├── index.ejs         # Dashboard list view
│   └── validate.ejs      # Validation form
├── n8n/
│   ├── workflows/        # n8n workflow JSON
│   ├── scripts/          # Transformation scripts
│   └── nodes/            # Custom node configs
├── docs/                 # Documentation
├── examples/             # Sample data
└── public/               # Static assets
```

## Adding a New Country

To add support for a new country:

1. **Create transformation script**:
   ```bash
   cp n8n/scripts/gtm_comprehensive_FINAL.js n8n/scripts/xyz_comprehensive_FINAL.js
   ```

2. **Analyze Kobo form structure**:
   - Export sample JSON from Kobo
   - Identify key field paths
   - Note percentage formats, array vs flat structure

3. **Adapt transformation logic**:
   - Update paths to match country form
   - Handle country-specific edge cases
   - Test with real data samples

4. **Add crop list** to `crops.json`:
   ```json
   {"Country":"XYZ","crops":["crop1","crop2",...]}
   ```

5. **Update documentation**:
   - Add to README supported countries table
   - Document any unique behaviors

6. **Create toy example**:
   - Add to `examples/kobo-data-samples/xyz-sample.json`
   - Anonymize all sensitive data

7. **Test end-to-end**:
   - n8n transformation
   - Google Sheets append
   - Dashboard display
   - Validation form

## Testing

Currently, the project relies on manual testing. **We welcome contributions to add automated tests!**

### Manual Testing Checklist

**Dashboard:**
- [ ] List view loads with pagination
- [ ] Country filter works
- [ ] Per-page selector changes results
- [ ] Photos display correctly
- [ ] Maps render at correct location
- [ ] Tabs switch properly

**Validation:**
- [ ] Form loads all data
- [ ] Maps show correct coordinates
- [ ] Photos clickable for fullscreen
- [ ] Dropdown populated (crops)
- [ ] Validation logic works (correct/incorrect/review)
- [ ] Crop requirement enforced for cropland
- [ ] Submit updates Google Sheets
- [ ] Redirect back to list

**API:**
- [ ] Photo upload accepts JPEG
- [ ] API key required and validated
- [ ] Large files handled (5MB+)
- [ ] Error responses are clear

## Documentation

### When to Update Docs

- **New features**: Update README, add to docs/
- **API changes**: Update docs/API.md
- **Config changes**: Update .env.example and docs/DEPLOYMENT.md
- **Bug fixes**: Update TROUBLESHOOTING.md if relevant

### Documentation Style

- **Be clear and concise**
- **Use examples** liberally
- **Include screenshots** for UI features
- **Update table of contents**
- **Link between docs** when relevant

## Questions?

- **General questions**: Use [GitHub Discussions](https://github.com/[your-username]/Land-cover-validation/discussions)
- **Bug reports**: [Create an issue](https://github.com/[your-username]/Land-cover-validation/issues/new)
- **Security issues**: Email directly (see SECURITY.md)

---

Thank you for contributing! 🌍💚
