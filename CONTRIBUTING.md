# Contributing to Logloop

This project uses [Conventional Commits](https://www.conventionalcommits.org/) and [standard-version](https://github.com/conventional-changelog/standard-version) for automated changelog and versioning.

## 🛠️ Development & Release

### Release Commands
- **`npm run release`**: Generates changelog and increments version (automatic patch/minor/major).
- **`npm run release:minor`**: Forces a minor release (vX.Y.0).
- **`npm run release:dry`**: Previews changes without executing the commit/tag.

### Local Development
- **`npm run site`**: Opens the project landing page (`site/index.html`).
- **`npm run preview`**: Opens the site and starts the CLI in development mode simultaneously.

### Commit Patterns
- `feat(scope): ...` -> New feature (Minor)
- `fix(scope): ...` -> Bug fix (Patch)
- `docs: ...` -> Documentation
- `chore: ...` -> Internal tasks
