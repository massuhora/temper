<p align="center">
  <img src="public/logo.png" width="120" alt="Temper logo">
</p>

# Temper

> Train structured thinking like you train code. Local-first. AI-powered. Markdown-native.

Temper is a desktop app for deliberate structured thinking practice. It combines spaced-repetition-style drills with real-time AI feedback to help you master frameworks like the **Pyramid Principle**, **MECE**, **PREP**, **SCQA**, **5W2H**, and **Logic Trees**.

Everything stays local — your questions, practice records, principles, and API key live in a SQLite database on your machine. No cloud, no tracking, no subscription walls.

---

## Why Temper

- **Local-first & Private** — All data in SQLite. Your API key never leaves your device.
- **AI Coach** — Streamed feedback on dimension scores, issue lists, and optimized rewrites via any OpenAI-compatible API (DeepSeek by default).
- **Two-Step Practice** — Forces *outline-before-body* discipline so you structure before you write.
- **Blind Framework Training** — Practice choosing the right framework without being told which one to use.
- **Markdown-Native** — Import/export single questions or full backups as Markdown + ZIP. Own your data.
- **Adaptive Training** — Auto-recommends weak points and mistake reviews based on your practice history.

---

## Quick Start

**Requirements**
- Node.js 22+
- pnpm
- Rust 1.77+

**Install & Run**

```bash
pnpm install
pnpm tauri dev
```

**Build**

```bash
pnpm lint         # ESLint
pnpm build        # Frontend production bundle
pnpm tauri build  # Desktop production bundle
```

---

## Usage

1. **Configure** your API key in *Data Management* (DeepSeek default; any OpenAI-compatible provider works).
2. **Create or import** questions via Markdown or ZIP.
3. **Train** using mistake review, weak-point drills, random draw, framework-specific practice, blind-pick mode, or timed sketching.
4. **Submit** your answer and receive structured feedback: dimension scores, concrete issues, and a rewritten reference answer.
5. **Iterate** on the same question across multiple rounds and track score deltas.
6. **Review** trends, radar charts, and your personal principle library on the *Stats Dashboard*.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, TypeScript, Tailwind CSS 4, shadcn/ui |
| Desktop | Tauri 2, Rust |
| Database | SQLite (rusqlite) |
| Charts | Recharts |
| AI API | OpenAI-compatible (native `fetch` + `ReadableStream` SSE) |
| Backup | Markdown + ZIP (JSZip) |

---

## Data & Privacy

- **Zero backend** — All data lives in `temper.db` inside your system's app data directory.
- **Portable** — Full backups export as ZIP with Markdown files for questions, records, principles, and weak-point analysis.
- **No sync, no login, no telemetry**.

---

## Built-in Frameworks

- **Pyramid Principle** — Conclusion first, top-down logic, grouping, progression.
- **MECE** — Mutually Exclusive, Collectively Exhaustive classification.
- **PREP** — Point, Reason, Example, Point.
- **SCQA** — Situation, Complication, Question, Answer.
- **5W2H** — Full-spectrum problem breakdown.
- **Logic Tree** — Decomposition, attribution, and solution enumeration.
