# Logloop

> Continuous loop of personal logs in the terminal.

Logloop is a minimal CLI that captures the reasoning behind your code — in real time, without leaving your terminal.

It turns your project history into a living narrative of decisions, not just diffs.

---

## Why Logloop?

Git is great at tracking what changed.

But it rarely answers:
- Why did we choose this approach?
- What trade-offs were considered?
- What problem were we actually solving?

Logloop fixes that by making it frictionless to document your thinking as you work.

---

## Installation

```bash
npm install -g logloop
```

---

Logloop is designed to stay open alongside your code.

### Continuous Mode (The Core Experience)
Run without arguments to enter the interactive loop:
```bash
logloop
```
This keeps your recent history visible and stays ready for your next thought. It's the "black box" for your development process.

### One-shot Mode
For a quick note without entering the loop:
```bash
logloop "Switched to native fetch"
```

### Standalone Mode (Git Optional)
Logloop can run without any Git dependency. If you are not in a Git repository, it degrades gracefully and continues to work. You can also explicitly force it to ignore Git:
```bash
logloop --standalone
```

### Global History
List all your local projects and their activity:
```bash
logloop list
```

---

## What happens?

Logloop automates the context capture:

- **Semantic Classification**: Automatically tags entry as `action`, `decision`, `question`, `media`, `noise` or `thought`.
- **Mood Heuristics**: Detects emotional state via keywords and emoticons (zero-friction).
- **Git Linking**: Attaches current `HEAD` hash and branch name.
- **ISO Timestamps**: Precise temporal tracking.
- **Paste Support**: Handles multi-line pastes from Word/Slack as single entries.
- **Training Mode**: Optional interactive confirmation of detected tags and mood (`/t`).
- **Media & Path Detection**: Auto-tagging of screenshots and file links.
- **Append-only storage**: Persists everything to `logloop.md`.

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

---

## Logloop Brain (v0.4.0)

Logloop is not just a logger; it's an evolving engine that learns your engineering dialect.

### The Intelligence Pipeline (3 Layers of Truth)
Every entry passes through a sophisticated inference pipeline before being saved:

1.  **Memory (The Personal Truth)**: Prioritized above all. It consults your historical corrections in `memory.json`.
2.  **Fuzzy (The Statistical Truth)**: Uses `fuse.js` to find lexical similarities, handling typos and variations.
3.  **Heuristics (The Lexical Truth)**: Deterministic rules based on a curated technical dictionary (verbs, symbols, sentiment). Now with **Negation Handling** (e.g., "not happy" correctly classified as neutral).

These layers combine into a **Weighted Confidence Score** to ensure high precision without the need for cloud-based AI.

### Active Learning & Portability
Logloop is not just a logger; it's an evolving assistant:
*   **/t**: Toggles **Training Mode**. In this mode, Logloop asks for confirmation/correction after each entry using a sleek, numeric selection interface.
*   **/as <category>**: Reclassifies the last entry and saves the preference to your memory.
*   **/feel <mood>**: Corrects the emotional context and trains the mood engine.
*   **/timeline**: Displays an ASCII activity chart.
*   **/summary**: Generates a standup-ready daily report.
*   **/brain-out <file> / /brain-in <file>**: Export/Import your learned patterns.
*   **/c, /m, /s**: Toggle Auto-commit, Mood Tracking, or Storage mode (Repo/Local).
*   **/e, /h, /q**: Open editor, toggle help, or quit the session.

### Insights & Analytics
*   **Visual History**: Run `logloop timeline` (or `/timeline`) for a weekly ASCII productivity chart.
*   **Smart Summary**: Run `logloop summary` (or `/summary`) to generate a **Markdown Daily Report** with decisions, questions, and mood, ready to copy-paste into your standup.

### Referencing with IDs
Every log entry now has a unique 4-character ID (e.g., `#a1b2`). 
*   **Traceability**: Use these IDs in your PRs or commit messages to point to specific decisions recorded in your logs.
*   **Visibility**: IDs are displayed in the terminal history for quick reference.

> **Learning Example**:
> You: `subir v1.0`
> Logloop: `[THOUGHT]` (Falls back to thought because it's unsure)
> You: `/as action`
> Logloop: `Last log reclassified as action and learned! ✨`
> *Next time you type `subir`, it will automatically be an `action`.*

---

## Privacy & Hackability

Logloop is **Local-First**. Your intelligence is your own.

*   **`~/.logloop/memory.json`**: This is your "Personal Brain Assets". It stores every correction you've ever made.
*   **Portability**: Sync your patterns across machines with Brain Sync.
*   **Insights**: Visualize your productivity with `logloop timeline`.
*   **Privacy**: No data leaves your machine. Classification happens 100% locally.
*   **Hackable**: You can manually edit your `memory.json` to add complex patterns or export it to another machine.

---

## Core Features

### Semantic Classification
Logloop analyzes your input to categorize the entry automatically:
- **Action**: Tasks, commits, and implementations. Triggered by leading verbs (PT/EN).
- **Decision**: Architectural choices and trade-offs.
- **Question**: Open doubts and research items (triggered by `?`).
- **Media**: Image paths ( `.png`, `.jpg`, etc.) or Markdown image syntax.
- **Thought**: General observations and context.

### Zero-Friction Mood Tracking
- **Emoticons**: High-priority detection ( `:)`, `T_T`, `O_O` ).
- **Sentiment Analysis**: Dynamic scoring based on text tone and intensity.

### Atomic Operations
Sync your thoughts with your code:
- `logloop --commit`: Logs and creates a Git commit in one step.
- `--no-commit`: Overrides `autoCommit: true` in config for one-off logs.

---

## Configuration

Logloop uses a cascading configuration system. It looks for a `.loglooprc` file in your project root, falling back to a global config in `~/.logloop/config.json`.

```json
{
  "userName": "your-name",
  "storage": "repo",
  "autoCommit": false,
  "moodTracking": true,
  "lang": "en"
}
```

### Storage Modes
- **repo** (Default): Saves logs to `logloop.{user}.md` in the current directory. Perfect for team transparency.
- **local**: Saves logs to `~/.logloop/logs/{project}.{user}.md`. Ideal for private journals in public repositories.

> **Tip**: Use the `/s` slash command inside the interactive loop to hot-swap between storage modes. This allows you to maintain a dual-channel history: one for your team (Shared) and one for yourself (Private).

---

## Philosophy

Logloop is not documentation. It is memory.

A lightweight layer on top of Git that captures **intent**, **reasoning**, and **context**.

---

## Output file

Default: `logloop.md`

---

## Roadmap

- [x] Semantic Classification (v2 - Advanced Pipeline)
- [x] Active Learning Loop (`/as`, `/feel`)
- [x] Local Memory Persistence
- [x] Fuzzy Matching & Normalization
- [x] Log IDs & Traceability
- [x] Timeline Visualization
- [x] Smart Deterministic Summaries
- [x] Standalone Mode (Git fully optional & hardened)
- [x] Multi-line Paste Support (Buffering & Grouping)
- [x] Training Mode (Interactive Confirmation & Sleek UI)
- [x] Media/Image Path Detection

---

## Technical Specification
Logloop follows a strict capability-mapping architecture. The project's features, commands, and core concepts are formally defined in the [capabilities.json](capabilities.json) manifest. This ensures 100% alignment between code, documentation, and internationalization.

---

## License
MIT © 2026 Chavito