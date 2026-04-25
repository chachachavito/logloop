# Commit System Implementation Plan

## 🎯 Goal
Implement `logloop commit` with optional AI integration via self-commit and a robust local fallback.

---

## 🧱 Core Command

- [ ] Create command `logloop commit`
- [ ] Parse CLI flags (`--ai`, `--no-ai`, `--message`, `--dry-run`)

---

## 🔍 Context Handling

- [ ] Retrieve last log entry (default)
- [ ] Support future: multiple logs (`--range`)
- [ ] Extract log ID for commit linking

---

## 🤖 Self-Commit Integration (Optional AI Layer)

- [ ] Detect if `self-commit` is installed
- [ ] Execute `self-commit` when available
- [ ] Pass context (logs + git changes) to self-commit
- [ ] Handle failure gracefully (fallback)

---

## 🧠 Fallback System (No AI)

- [ ] Generate basic commit message from:
  - last log content
  - git diff (optional)
- [ ] Ensure structured format:
  - type(scope): message (#logId)

---

## ⚙️ Flags Behavior

- [ ] `--ai` → force use of self-commit
- [ ] `--no-ai` → disable self-commit
- [ ] `--message` → override generated message
- [ ] `--dry-run` → preview commit without executing

---

## 🔗 Git Integration

- [ ] Run `git commit` with generated message
- [ ] Ensure log ID is included in message
- [ ] Handle empty diff / no changes edge case

---

## 💬 UX & Feedback

- [ ] Show generated commit before execution
- [ ] Show hint if self-commit is not installed
- [ ] Handle errors with clear fallback messages

---

## 🧪 Testing

- [ ] Test with self-commit installed
- [ ] Test without self-commit
- [ ] Test with no logs
- [ ] Test with invalid git state

---

## 🚀 Future Enhancements

- [ ] Interactive commit editing (`--edit`)
- [ ] Multi-log summarization
- [ ] Config via `.loglooprc`
- [ ] AI refinement mode (`--refine`)