

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

That context gets lost.

Self-Log fixes that by making it frictionless to document your thinking as you work.

---

## Installation

```
npm install -g self-log
```

---

## Usage

Run inside any project:

```
self-log
```

Write a quick note about your decision, challenge, or idea.

That’s it.

---

## What happens?

Self-Log will:

- Capture your message
- Add a timestamp
- Link it to the current Git commit (if available)
- Append everything to `SELF-LOG.md`

---

## Example

```
## [2026-04-24 14:32:00]
commit: 2cc9be8c15fc9045d72decbdabaea71caca8082d
branch: main

Switched from axios to native fetch to reduce bundle size.
```

---

## Advanced usage

### Commit + Log (atomic)

```
self-log --commit
```

Logs your thought and creates a Git commit in one step. (Disabled by default; use `--commit` or configure `.selflogrc`).

---

### Configuration

Self-Log uses a `.selflogrc` file for persistent settings.

```json
{
  "autoCommit": false
}
```

---

## Philosophy

Self-Log is not documentation.

It is memory.

A lightweight layer on top of Git that captures:
- intent
- reasoning
- context

So you and your team can understand not just the code,
but the thinking behind it.

---

## Output file

Default:

```
SELF-LOG.md
```

Why not DEVLOG.md?

Because this is not just a dev log.

It is a Self Log — a structured record of decision-making.

---

## Roadmap

- Bidirectional commit linking
- Log IDs (UUID)
- Search and filtering
- Timeline visualization
- AI-powered summaries
- Integration with self-commit

---

## Contributing

PRs are welcome.

---

## License

MIT