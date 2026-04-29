# Logloop (v0.3.5)

> **Git tracks WHAT changed. Logloop tracks WHY.**

Logloop is a local-first CLI that acts as your rubber duck that remembers everything. It lives beside your editor to capture the reasoning behind your code in real-time, turning isolated commits into a traceable, living narrative.

---

## 🚀 Why Logloop?

You write a brilliant workaround today. Three months later, a teammate (or you) looks at the code and asks: *"Why on earth was this done?"*

Git tells you the lines changed. Logloop gives you the context:
- 🧠 **Semantic Classification**: Auto-tags logs as `action`, `decision`, `question`, `media`, `noise`, or `thought`.
- 🔗 **Git Linking**: Anchors every thought to the exact `HEAD` hash.
- 🔒 **Local-First Active Learning**: Learns your engineering dialect without ever sending data to the cloud.
- 📟 **Your Second Terminal**: Open it alongside your editor and let your thoughts flow as you code.

---

## 📦 Getting Started

### The Ritual (Getting Started)
Logloop works best as a second terminal — open it alongside your editor and let it become your development journal.

1. **Install globally**: `npm install -g logloop`
2. **Open your project** in your editor.
3. **Open a second terminal** and start the loop:
   ```bash
   cd your-project && logloop
   ```
*Just type your thoughts as you work. They will be timestamped, classified, and linked to the current Git state automatically.*

### One-Shot & Standalone
If you just need to drop a quick note without entering the loop:
```bash
logloop "Refactoring auth service to use hooks."
```

> [!TIP]
> **Quotes & Special Characters**: You can run `logloop` without quotes for simple text. However, if your message contains special shell characters (like `(`, `)`, `!`, `&`, `*`) or emoticons (like `:)`), you **must** use quotes to prevent your terminal (bash, zsh, fish) from misinterpreting the command. Actual Unicode emojis (🚀, ✨) work fine without quotes.

*Note: Logloop degrades gracefully. If you run it outside a Git repository or use the `--standalone` flag, it skips Git linking and continues to work flawlessly.*


---

## 🧠 The Logloop Brain (AI-less Intelligence)

Privacy is a pillar. Logloop categorizes your logs without sending data to external APIs. It uses a **3-Layer Inference Pipeline**:

1. **Memory (Personal Truth)**: Prioritizes your historical corrections via `memory.json`.
2. **Fuzzy Matching**: Uses `fuse.js` to handle typos and lexical variations locally.
3. **Heuristics**: Deterministic rules covering technical verbs, negations, and sentiment.

### 🛠️ Customizing Heuristics
The deterministic rules for mood and category classification reside in `src/classifier.js`. 
If you notice that specific terms from your engineering dialect are being misclassified, the regular expressions can be adjusted directly in `MOOD_CATEGORIES` or `MESSAGE_CATEGORIES`.


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

### 🌐 Global Mode (Unified Memory)
Access all your logs from all projects in a single view:
*   **`logloop global list`**: Chronological list of all projects.
*   **`logloop global summary`**: Consolidated insights from your entire journey.
*   **`logloop global search "<term>"`**: Search through your entire history.
*   **`logloop global filter --type <type>`**: Filter by type (e.g., decision).

### Platform Context (Source)
Logloop automatically detects the log origin (`desktop` or `mobile`). 
This field exists to allow correlation between spontaneous ideas (mobile) and technical execution (desktop), 
and it is populated without user intervention to ensure your flow is never interrupted.

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

### Storage Strategies
You have full control over where your data is saved:
- **`repo` (Default)**: Writes to `logloop.md` within the project. Focused on team transparency.
- **`local`**: Writes to `~/.logloop/logs/`. Your private engineering journal.
- **`mirror`**: Writes to both. The best of both worlds.

*(Pro Tip: Use `/s` in the interactive loop to toggle quickly).*

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

## 🛠️ Development & Release

This project uses [Conventional Commits](https://www.conventionalcommits.org/) and [standard-version](https://github.com/conventional-changelog/standard-version) for automated changelog and versioning.

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

## ❓ Frequently Asked Questions

**Does Logloop replace Git?**
No. Git tracks code changes. Logloop tracks the reasoning behind them.

**Does it work without Git?**
Yes, it degrades gracefully. You can also use the `--standalone` flag for a fully Git-free workflow.

**How does the Brain learn?**
It adapts via explicit commands (`/as`, `/feel`) or via **Training Mode (`/t`)**, which prompts for confirmation after every entry.

**What does --commit do?**
It links your log entry directly to a Git commit hash, anchoring your thought to the exact state of the code at that moment.

**Does any data leave my machine?**
No. Everything is stored locally. No external services, no cloud, no telemetry.

**Can I sync across machines?**
Yes, using your own tools like Git or cloud storage. Use `/brain-out` to export your learned patterns and `/brain-in` to import them on another machine.

**Where are my logs stored?**
By default, logs are written to `logloop.md` inside your project (repo mode). You can switch to local mode (`~/.logloop/logs/`) or mirror mode (both) using `/s` inside the loop or by editing `.loglooprc`.

**What is the difference between repo, local, and mirror storage?**
**repo** writes to your project folder — great for team transparency and keeping decisions close to the code. **local** writes to a private folder on your machine — good for personal notes you don't want in the repo. **mirror** writes to both simultaneously.

**What are the log categories?**
Logloop auto-classifies each entry as one of: action, decision, question, media, noise, or thought. You can correct any misclassification with `/as <category>` and the Brain will remember your preference.

**What is mood tracking?**
Logloop infers an emotional signal from your writing — frustrated, focused, uncertain, confident, and so on. It's optional and can be toggled with `/m`. Over time it gives you a picture of how you feel during different kinds of work.

**How do I use Logloop in a team?**
Set storage to repo mode so logs land in `logloop.md` inside the project. Commit that file alongside your code. Teammates can read the reasoning behind changes directly in the repo, without any extra tooling.

**Do I have to keep the loop open all day?**
No. You can use `logloop "message"` for one-shot entries without entering the loop at all. The loop is the recommended experience for deep work sessions, but it's not required.

**What is Global Mode?**
Global Mode gives you a unified view across all your projects. Use `logloop global summary` for a consolidated daily report, `logloop global search "term"` to find past decisions, and `logloop global filter --type decision` to filter by category.

**Is there a VS Code extension?**
Not yet — it's on the roadmap for v1.0. For now, Logloop works best as a second terminal alongside your editor.

MIT © 2026 Chavito