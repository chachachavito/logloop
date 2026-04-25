# Logloop (v0.4.1)

> **Git tracks WHAT changed. Logloop tracks WHY.**

Logloop is a zero-friction, local-first CLI that captures the reasoning behind your code in real-time. It acts as the "black box" for your development process, turning isolated commits into a traceable, living narrative of architectural decisions.

---

## 🚀 Why Logloop?

You write a brilliant workaround today. Three months later, a teammate (or you) looks at the code and asks: *"Why on earth was this done?"*

Git tells you the lines changed. Logloop gives you the context:
- 🧠 **Semantic Classification**: Auto-tags logs as `action`, `decision`, `question`, `media`, `noise`, or `thought`.
- 🔗 **Git Linking**: Anchors every thought to the exact `HEAD` hash.
- 🔒 **Local-First Active Learning**: Learns your engineering dialect without ever sending data to the cloud.
- ⚡ **Zero-Friction**: Stays open in your terminal. Think it. Type it. Done.

---

## 📦 Getting Started

### Installation
```bash
npm install -g logloop
```

### The Core Experience (Continuous Loop)
Logloop is designed to stay open alongside your code. Run it in your project root:
```bash
logloop
```
*Just type your thoughts as you work. They will be timestamped, classified, and linked to the current Git state automatically.*

### One-Shot & Standalone
If you just need to drop a quick note:
```bash
logloop "Switched from axios to native fetch to reduce bundle size."
```
*Note: Logloop degrades gracefully. If you run it outside a Git repository or use the `--standalone` flag, it skips Git linking and continues to work flawlessly.*

---

## 🧠 The Logloop Brain (AI-less Intelligence)

Privacy is a pillar. Logloop categorizes your logs without sending data to external APIs. It uses a **3-Layer Inference Pipeline**:

1. **Memory (Personal Truth)**: Prioritizes your historical corrections via `memory.json`.
2. **Fuzzy Matching**: Uses `fuse.js` to handle typos and lexical variations locally.
3. **Heuristics**: Deterministic rules covering technical verbs, negations, and sentiment.

### Active Learning
The system learns as you correct it.
*   **`/t` (Training Mode)**: Forces interactive confirmation of category and mood after every log.
*   **`/as <category>`**: Reclassifies your last entry (e.g., `/as decision`) and saves the pattern permanently.
*   **Brain Sync**: Export (`/brain-out`) and import (`/brain-in`) your `memory.json` to share your trained patterns across machines.

---

## 📊 Analytics & Insights

Stop guessing what you did yesterday during your daily standup.
*   **`logloop summary`** (or `/summary`): Generates a Markdown report of the last 24h, extracting key decisions, unresolved questions, and your mood balance.
*   **`logloop timeline`** (or `/timeline`): Displays a visual ASCII activity chart directly in your terminal.

---

## ⚙️ Configuration & Storage

Logloop relies on a cascading configuration (local `./.loglooprc` overrides global `~/.logloop/.loglooprc`).

```json
{
  "storage": "repo",
  "autoCommit": false,
  "moodTracking": true,
  "durable": false
}
```

### Dual-Channel Storage
- **`repo` (Default)**: Writes to `logloop.md` in the project folder. Great for team transparency.
- **`local`**: Writes to `~/.logloop/logs/`. Ideal for private engineering journals on corporate/public projects.
*(Tip: Type `/s` in the interactive loop to hot-swap between storage modes instantly).*

---

## ⌨️ Command Reference

All available slash commands inside the interactive loop:
*   `/c` - Toggle Git Auto-commit
*   `/m` - Toggle Mood Tracking heuristic
*   `/s` - Toggle Storage mode (Repo / Local)
*   `/t` - Toggle Training Mode (Interactive UI)
*   `/e` - Open current log file in system editor (`nano`/`vim`/`code`)
*   `/as` - Reclassify last entry and train the model
*   `/feel` - Override last entry mood and train the model
*   `/timeline` - Display ASCII timeline of activity
*   `/summary` - Display daily analytical summary
*   `/brain-out` - Export memory patterns
*   `/brain-in` - Import and merge memory patterns
*   `/h` - Toggle help menu visibility
*   `/q` - Quit the session

---

## 🏗️ Roadmap

- [x] Semantic Classification & Fuzzy Matching
- [x] Local Active Learning (Memory Persistence)
- [x] Analytics (Timeline & Summary)
- [x] Standalone & Restricted Environment Hardening
- [x] Multi-line Paste & Media Path Detection
- [x] Training Mode (Interactive UI)
- [ ] Web Dashboard & Data Visualization (v1.0)
- [ ] VS Code Extension Integration (v1.0)
- [ ] Bidirectional Link Generation (UUID indexing) (v2.0)

---

## 📜 Technical Specification
Logloop follows a strict capability-mapping architecture. The project's features, commands, and core concepts are formally defined in the [capabilities.json](capabilities.json) manifest. This ensures 100% alignment between code, documentation, and internationalization.

MIT © 2026 Chavito