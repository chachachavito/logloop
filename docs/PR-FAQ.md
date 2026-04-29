# PR-FAQ: Logloop Global & Configurable Storage

## Press Release: Unifying Engineering Memory with Logloop 0.5.0

**CITY, Date** — Chavito today announced the release of Logloop 0.5.0, introducing "Global Mode" and a "Configurable Storage Strategy." These features bridge the gap between team-wide transparency and personal engineering journals, allowing developers to maintain a unified memory across all their projects without losing local-first control.

"Logloop was built to capture the 'Why' behind the code," said Chavito. "With 0.5.0, we are making that 'Why' searchable and aggregatable across your entire portfolio. Whether you're switching between three client projects or building a side hustle, your insights are no longer siloed."

### Unified Memory, Distributed Storage
The new Storage Strategy gives users explicit control. Choose `repo` for team transparency, `local` for private journaling, or `mirror` for the best of both worlds. Combined with `logloop global`, developers can now generate cross-project summaries and timelines, turning scattered notes into a powerful professional archive.

---

## Frequently Asked Questions

### What is Global Mode?
Global Mode (`logloop global`) is a read-only aggregation layer. It scans all your local logs stored in `~/.logloop/logs/` and presents them as a single, searchable timeline. It allows you to run `list`, `timeline`, `summary`, and `search` across every project you've worked on.

### How does the Storage Strategy work?
You can now configure where Logloop writes your data in `~/.logloop/config.json`:
- **repo**: Writes only to `logloop.md` in your current project.
- **local**: Writes only to `~/.logloop/logs/<project>.md`.
- **mirror**: Writes to both simultaneously.

### Does Logloop send my data to the cloud?
No. Logloop remains 100% local-first. Global Mode works by reading files already on your disk. No databases, no external APIs, no cloud.

### What is the 'source' field?
Logloop 0.5.0 automatically detects if you are logging from a `desktop` or `mobile` environment (via Termux). This allows you to track when ideas happened on the go vs. during technical execution.

### How do I use the new filters?
You can filter your global history by type or mood:
`logloop global filter --type decision`
`logloop global filter --mood focused`

### Can I access Global Mode via the Dashboard?
Yes. The Dashboard now includes a unified view that aggregates local log files. The Dashboard backend automatically scans your configured log directory to provide a visual, searchable timeline of your entire engineering history.
        