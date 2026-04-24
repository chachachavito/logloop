# Self-Log

> Git shows what changed. Self-Log shows why.

Self-Log is a minimal CLI that captures the reasoning behind your code — in real time, without leaving your terminal.

It turns your project history into a living narrative of decisions, not just diffs.

---

## Why Self-Log?

Git is great at tracking what changed.

But it rarely answers:
- Why did we choose this approach?
- What trade-offs were considered?
- What problem were we actually solving?

Self-Log fixes that by making it frictionless to document your thinking as you work.

---

## Installation

```bash
npm install -g self-log
```

---

Self-Log is designed to stay open alongside your code.

### Continuous Mode (The Core Experience)
Run without arguments to enter the interactive loop:
```bash
self-log
```
This keeps your recent history visible and stays ready for your next thought. It's the "black box" for your development process.

### One-shot Mode
For a quick note without entering the loop:
```bash
self-log "Switched to native fetch"
```

---

## What happens?

Self-Log automates the context capture:

- **Semantic Classification**: Automatically tags entry as `decision`, `question`, `noise` or `thought`.
- **Mood Heuristics**: Detects emotional state via keywords and emoticons (zero-friction).
- **Git Linking**: Attaches current `HEAD` hash and branch name.
- **ISO Timestamps**: Precise temporal tracking.
- **Append-only storage**: Persists everything to `SELF-LOG.md`.

---

## Example

```markdown
## [2026-04-24T14:32:00.000Z]
commit: 2cc9be8c15fc9045d72decbdabaea71caca8082d
branch: main
type: decision
mood: focused

Switched from axios to native fetch to reduce bundle size.
```

---

## Core Features

### Semantic Classification
The CLI analyzes your input to categorize the entry automatically:
- **Decision**: Triggered by keywords like "decidi", "escolhi", "vou usar".
- **Question**: Triggered by the presence of `?`.
- **Noise**: Short or trivial messages (e.g., "test", "ss").
- **Thought**: Default category for general notes.

### Zero-Friction Mood Tracking
Captures emotional context without manual prompts:
- **Heuristics**: Uses a dictionary of emoticons ( `:)`, `T_T`, `O_O` ) and keywords ( "sucesso", "erro", "cansado" ).
- **Opt-in**: Enable via config to start tracking.
- **Manual override**: Use `--mood <value>` for explicit control.

### Atomic Operations
Sync your thoughts with your code:
- `self-log --commit`: Logs and creates a Git commit in one step.
- `--no-commit`: Overrides `autoCommit: true` in config for one-off logs.

---

## Configuration

Self-Log uses a `.selflogrc` file for persistent settings.

```json
{
  "autoCommit": false,
  "moodTracking": true
}
```

---

## Philosophy

Self-Log is not documentation. It is memory.

A lightweight layer on top of Git that captures **intent**, **reasoning**, and **context**.

---

## Output file

Default: `SELF-LOG.md`

---

## Roadmap

- [x] Semantic Classification (v1)
- [x] Git HEAD/Branch linking
- [x] Mood Tracking Heuristics
- [ ] Log IDs (UUID)
- [ ] Timeline visualization
- [ ] AI-powered summaries

---

## License

MIT