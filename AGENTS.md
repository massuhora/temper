# AGENTS.md — Temper Project Guide

> This file is intended for AI coding assistants. If you are reading this, assume you know nothing about the project and strictly follow the conventions below.

---

## 1. Project Overview

**Temper** is a local-first structured thinking training tool, built as a desktop application with Tauri 2. It does not rely on any backend or cloud services. All data is stored in a local SQLite database, and import/export is done via Markdown + YAML Frontmatter.

Core features:
- **Today's Training**: Mistake review, weak-point recommendations, random practice from the full bank, framework-specific training, blind framework training, timed structure sketching
- **Question Bank**: CRUD for questions, filtering by framework / tags / keywords, single-question Markdown export, full ZIP export
- **Practice Flow**: Supports diagnostic error-correction, classification reconstruction, timed sketching, and custom real-world questions; **two-step answering** requires writing an outline before the body; **principle library integration** surfaces relevant principles before and after practice; after submission, receive streamed AI feedback; supports multi-round iteration on the same question with score comparison
- **Statistics Dashboard**: Total practice count, average score, mistake count, active days, ability radar chart, weekly/monthly trends, framework average scores, frequent error types, personal principle library
- **Data Management**: Import single Markdown / folder / full ZIP backup; export mistake book / full ZIP; configure DeepSeek API Key, API URL, default model, mistake threshold, practice duration, strict sketch mode
- **Question Generation**: Paste a work document and call the model to generate training questions

Built-in training frameworks: Pyramid Principle, MECE, PREP, SCQA, 5W2H, Logic Tree.

---

## 2. Tech Stack

| Layer | Technology | Version / Notes |
|-------|------------|-----------------|
| Frontend framework | React | 19 |
| Build tool | Vite | 8 |
| Language | TypeScript | ~6.0 |
| Styling | Tailwind CSS | 4 (uses `@import "tailwindcss"` and `@theme inline` syntax) |
| Components | shadcn/ui | new-york style; source lives in `src/components/ui/` |
| Icons | Lucide React | — |
| Charts | Recharts | Radar charts and line charts |
| Desktop | Tauri 2 | Rust |
| Database | SQLite | rusqlite |
| ZIP | JSZip | Backup import/export |
| AI API | OpenAI-compatible | Default is DeepSeek; uses native `fetch` + `ReadableStream` SSE parsing |

---

## 3. Directory Structure

```
src/
  components/ui/    # Raw shadcn/ui components (Button, Card, Dialog, Sheet, etc.)
  db/               # Tauri invoke wrapper layer: calls Rust Commands via `invoke`
    index.ts               # TemperDB class and `db` instance
    markdown.ts            # Conversion between Question and Markdown
  hooks/            # Custom React Hooks (e.g., useAIStream)
  layouts/          # Page-level layouts (AppLayout: sidebar + mobile top bar)
  pages/            # Page-level components
    TodayTraining.tsx      # Today's training entry
    QuestionBank.tsx       # Question bank management
    PracticeSession.tsx    # Practice UI (timer, answering, AI feedback)
    Statistics.tsx         # Statistics dashboard
    DataManagement.tsx     # Data import/export and settings
    KnowledgeBase.tsx      # Knowledge / principle library page
    index.ts               # Unified re-exports
  services/         # Side-effect logic
    aiPrompts.ts           # AI system / user prompt construction
    markdownExport.ts      # Markdown / ZIP export
    markdownImport.ts      # Markdown / ZIP import parsing
  lib/              # Utilities and business logic
    utils.ts               # General utilities like `cn()`
    frontmatter.ts         # YAML frontmatter parsing and serialization
    frameworks.ts          # Built-in framework constants BUILTIN_FRAMEWORKS
    feedbackParser.ts      # Parses dimension scores, issue list, optimized version from AI output
    statistics.ts          # Statistics computation (trends, averages, error distribution)
    trainingRecommendation.ts  # Weak-point analysis and question recommendation
    sketchTopics.ts        # Timed sketch topic generation
    defaultQuestions.ts    # Default question bank (auto-loaded for new users)
  types/            # Shared TypeScript type definitions
src-tauri/
  src/lib.rs        # Rust backend: DB initialization, CRUD Commands, unit tests
  src/main.rs       # Tauri app entry point
  Cargo.toml        # Rust dependency configuration
  tauri.conf.json   # Tauri app configuration
  capabilities/     # Permission config (dialog, fs, etc.)
  icons/            # App icons
public/
  favicon.png       # App icon
  icons.svg         # Icon sprite sheet
  logo.png          # App logo
  manifest.json
  robots.txt
```

---

## 4. Build, Development, and Test Commands

The project uses `pnpm` (`pnpm-lock.yaml` is present). Common commands:

```bash
# Install frontend dependencies
pnpm install

# Fetch Rust dependencies (optional)
cd src-tauri && cargo fetch

# Start desktop development mode
pnpm tauri dev

# Type check + frontend static build (outputs to dist/)
pnpm build

# Build desktop production bundle
pnpm tauri build

# ESLint check
pnpm lint

# Rust tests
cd src-tauri && cargo test

# Rust compile check
cd src-tauri && cargo check
```

**Quality gate**: The Rust backend has unit tests (`cargo test`). Before committing, `pnpm lint`, `pnpm build`, and `cargo test` must all pass.

---

## 5. Code Style and Naming Conventions

- **Indentation**: 2 spaces
- **Semicolons**: Mostly omitted
- **Component / page filenames**: PascalCase (e.g., `TodayTraining.tsx`, `AppLayout.tsx`)
- **Functions and variables**: camelCase
- **Custom Hooks**: `use` prefix (e.g., `useAIStream`)
- **Import paths**: Use `@/` alias pointing to `src/`
- **UI copy**: Use Simplified Chinese, keep it concise, unless the feature is intentionally bilingual
- **Fonts and colors**:
  - Body / UI: JetBrains Mono
  - Headings / display: Vollkorn
  - Colors use OKLCH semantic tokens (defined in `src/index.css`); do not introduce arbitrary hex values
- **Interaction guidelines**:
  - All interactive elements must have `active:scale-95` press feedback (already set globally for button/a/input in `src/index.css`)
  - Icons always use `strokeWidth={1.5}`
  - Numeric displays use `tabular-nums`
  - Animations must only use `transform` and `opacity`; animating `width/height/margin/padding` is prohibited

---

## 6. Routing and Page Architecture

This project **does not use React Router**. Routing state is managed by `useState` in `App.tsx`:

```ts
type Page = "today" | "bank" | "practice" | "stats" | "data" | "knowledge"
```

- `AppLayout` provides a fixed left sidebar (240 px on desktop) and a mobile top-bar with drawer navigation.
- The `practice` page passes parameters via `practiceQuestionId` (question ID) and `practiceMode` (`'normal' | 'blind'`) state, not URL query params.
- Except for the `today` page, all other pages are lazy-loaded with `React.lazy` + `Suspense`.

To add a new page:
1. Create `Xxx.tsx` in `src/pages/`
2. Export it from `src/pages/index.ts`
3. Add a branch to the `Page` union and the `renderPage` `switch` in `App.tsx`
4. Add a nav item in `AppLayout.tsx`’s `navItems` if needed

---

## 7. Data Model and Storage

### 7.1 SQLite Schema (Rust Backend)

The database file is `temper.db` in the system app data directory, managed by `src-tauri/src/lib.rs`.

**questions**
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT PRIMARY KEY | Unique question identifier |
| type | TEXT NOT NULL | Question type (e.g., "诊断改错题") |
| framework | TEXT NOT NULL | Framework (e.g., "金字塔原理") |
| title | TEXT | Title |
| prompt | TEXT | Hint / guidance |
| content | TEXT | Question body |
| reference_answer | TEXT | Reference answer |
| difficulty | TEXT | Difficulty |
| source | TEXT | Source |
| is_mistake | INTEGER DEFAULT 0 | Whether marked as a mistake |
| tags | TEXT (JSON) | JSON string of tag array |
| common_errors | TEXT (JSON) | JSON string of common error array |
| created_at | TEXT | Creation time ISO string |

**records**
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT PRIMARY KEY | Unique record identifier |
| question_id | TEXT NOT NULL | Associated question ID |
| framework | TEXT NOT NULL | Framework used |
| practiced_at | TEXT NOT NULL | Practice time ISO string |
| overall_score | REAL | Total score |
| attempt | INTEGER | Attempt number |
| duration_seconds | INTEGER | Practice duration in seconds |
| dimension_scores | TEXT (JSON) | Dimension scores JSON |
| issue_list | TEXT (JSON) | Issue list JSON array |
| user_answer | TEXT | User's answer |
| outline | TEXT | Structural outline |
| ai_feedback | TEXT | Raw AI feedback |
| ai_optimized_version | TEXT | AI-optimized version |
| optimized_answer | TEXT | User-saved optimized version |
| messages | TEXT (JSON) | Conversation history JSON |
| is_time_expired | INTEGER | Whether time expired |

**principles**
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT PRIMARY KEY | Unique principle identifier |
| title | TEXT NOT NULL | Principle title |
| content | TEXT NOT NULL | Principle content |
| tags | TEXT (JSON) | JSON string of tag array |
| created_at | TEXT | Creation time |
| updated_at | TEXT | Update time |

**settings**
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER PRIMARY KEY CHECK(id = 1) | Fixed to 1 |
| deepseek_api_key | TEXT | API Key |
| deepseek_api_url | TEXT | API URL |
| default_model | TEXT | Default model |
| mistake_threshold | INTEGER DEFAULT 6 | Mistake score threshold |
| practice_duration_seconds | INTEGER DEFAULT 300 | Default practice duration |
| strict_sketch_mode | INTEGER DEFAULT 0 | Strict timed-sketch mode |
| language | TEXT DEFAULT 'en' | UI language preference; defaults to English |

### 7.2 Core Types (`src/types/index.ts`)

```ts
interface Question {
  id: string;            // Required
  type: string;          // Required (e.g., "诊断改错题")
  framework: string;     // Required (e.g., "金字塔原理")
  title?: string;
  prompt?: string;        // Hint / guidance
  content?: string;       // Question body
  source?: string;        // Source
  referenceAnswer?: string;
  commonErrors?: string[];
  tags?: string[];
  difficulty?: string;
  isMistake?: number;     // 0 or 1
  createdAt?: string;
  // ...
}

interface PracticeRecord {
  id: string;            // Format is usually `${questionId}-${practicedAt}`
  questionId: string;
  framework: string;
  practicedAt: string;   // ISO time string
  overallScore?: number;
  attempt?: number;
  durationSeconds?: number;
  dimensionScores?: Record<string, number>;
  issueList?: string[];
  userAnswer?: string;
  outline?: string;      // Structural outline in two-step answering
  aiFeedback?: string;
  aiOptimizedVersion?: string;
  optimizedAnswer?: string; // User-saved optimized version
  messages?: Message[];
  isTimeExpired?: boolean;
}

interface Principle {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface AppSettings {
  id: number;            // Fixed to 1
  deepseekApiKey?: string;
  deepseekApiUrl?: string;
  defaultModel?: string; // Default "deepseek-chat"
  mistakeThreshold?: number; // Default 6
  practiceDurationSeconds?: number; // Default 300
  strictSketchMode?: boolean; // Default false
  language?: string;     // Default "en"
}
```

### 7.3 Data Access Pattern

The frontend accesses data through the `TemperDB` class in `src/db/index.ts`, using `invoke` to call Rust Commands. Do not manipulate SQLite directly:

```ts
import { db } from "@/db"

// Question
await db.getAllQuestions()
await db.getQuestionById(id)
await db.addQuestion(q)
await db.updateQuestion(id, changes)
await db.deleteQuestion(id)

// Record
await db.getAllRecords()
await db.getRecordsByQuestionId(questionId)
await db.addRecord(r)
await db.updateRecord(id, changes)

// Principle
await db.getAllPrinciples()
await db.addPrinciple(p)
await db.updatePrinciple(id, changes)
await db.deletePrinciple(id)

// Settings
await db.getSettings()
await db.updateSettings(changes)

// Mistakes (auto + manual)
await db.getMistakeQuestions()

// Clear all data
await db.clearAllData()
```

---

## 8. AI Streaming Requests

AI interactions are encapsulated in `src/hooks/useAIStream.ts`, calling an OpenAI-compatible Chat Completions API directly:

```ts
const { submit, content, isLoading, error, abort } = useAIStream({
  apiKey: settings.deepseekApiKey || "",
  apiUrl: settings.deepseekApiUrl,
  model: settings.defaultModel,
  onFinish: (fullContent) => { /* ... */ },
})

submit([
  { role: "system", content: "..." },
  { role: "user", content: "..." },
])
```

**Notes**:
- Uses native `fetch` + `ReadableStream` to parse SSE manually; Vercel AI SDK is not used
- API config is stored in local SQLite (`settings` table) and never uploaded to any server
- Prompts are defined in `src/services/aiPrompts.ts`; AI output is parsed into structured data by `src/lib/feedbackParser.ts`

---

## 9. Markdown Import / Export Specification

### 9.1 Question Format

```markdown
---
id: q-001
type: 诊断改错题
framework: 金字塔原理
title: 周报重写练习
tags: [工作汇报, 结论先行]
createdAt: 2026-04-15T10:00:00.000Z
difficulty: 中
source: 手动录入
isMistake: 0
---

## 题目

题目正文

## 参考答案

参考答案正文

## 常见错误点

- 错误点 1
- 错误点 2
```

Required fields: `id`, `type`, `framework`

### 9.2 Practice Record Format

```markdown
---
id: q-001-1713160800000
practicedAt: 2026-04-15T14:00:00.000Z
questionId: q-001
framework: 金字塔原理
overallScore: 6.5
attempt: 2
durationSeconds: 318
dimensionScores: "{\"结论先行\":5,\"MECE 完整度\":7}"
issueList: [结论靠后, 分类边界不清]
---

## 我的作答
...

## AI 反馈
...

## 优化版本
...

## 问题清单

- 结论靠后
- 分类边界不清

## 对话记录

**user**: ...

**assistant**: ...
```

Required fields: `id`, `practicedAt`, `questionId`, `framework`

### 9.3 Principle Library Format

```markdown
---
id: principle-001
title: 写汇报前先确认听众最关心的三个问题
tags: [汇报, 沟通]
createdAt: 2026-04-15T14:00:00.000Z
updatedAt: 2026-04-15T14:00:00.000Z
---

正文内容
```

### 9.4 Import Strategy

Two merge strategies are supported during import (deduplicated by `id`):
- `skip`: Skip duplicates
- `overwrite`: Overwrite duplicates

Entry functions: `importFromFiles()` and `importFromZip()` in `src/services/markdownImport.ts`.

---

## 10. Security and Privacy Notes

- **Purely local app**: All data (including the API Key) is stored only in the local SQLite database
- **API Key must not leak**: Do not print the user's `deepseekApiKey` to logs or upload it to any external service
- **Data loss risk**: Uninstalling the app or deleting the app data directory may lead to data loss; mitigated by the full ZIP backup feature

---

## 11. Design System Cheatsheet (Agent Prompt Reference)

Full design docs are in `docs/DESIGN.md`. Common tokens:

| Token | Light | Dark |
|-------|-------|------|
| background | `oklch(0.99 0.003 80)` | `oklch(0.12 0.005 80)` |
| foreground | `oklch(0.20 0.01 80)` | `oklch(0.90 0.005 80)` |
| primary | `oklch(0.55 0.14 75)` | `oklch(0.65 0.15 75)` |
| card | `oklch(1 0 0)` | `oklch(0.22 0.007 80)` |
| border | `oklch(0.88 0.004 80)` | `oklch(1 0 0 / 8%)` |

- Button radius: `6px` (`--radius-md`)
- Card radius: `8px` (`--radius-lg`)
- Display font: Vollkorn
- Body font: JetBrains Mono
- Icon stroke: `strokeWidth={1.5}`
- Press feedback: `active:scale-95`

---

## 12. When to Update This File

You must keep this file in sync if you make any of the following changes:
- Add / remove build commands or dev dependencies
- Modify SQLite schema, Rust Commands, or core type definitions
- Add a page route or change the routing architecture
- Change Markdown import / export format specifications
- Update design tokens or global styling conventions
- Introduce a new testing framework or quality gate process
