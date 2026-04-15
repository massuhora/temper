import JSZip from "jszip";
import i18n from "@/i18n";
import { parseFrontmatter } from "@/lib/frontmatter";
import type { Message, MessageRole, PracticeRecord, Principle, Question } from "../types";

export interface ImportResult {
  added: number;
  skipped: number;
  errors: string[];
}

export interface ImportFullResult {
  questions: Question[];
  records: PracticeRecord[];
  principles: Principle[];
  result: ImportResult;
}

function tryParseJson<T>(value: unknown): T | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function parseMessagesFromSection(section: string): Message[] | undefined {
  const json = tryParseJson<Message[]>(section.replace(/```json\n?|\n?```/g, ""));
  if (json) return json;

  const messages: Message[] = [];
  const blocks = section.split(/\n\n+/).filter(Boolean);
  for (const block of blocks) {
    const match = block.match(/^\*\*(system|user|assistant)\*\*:\s*([\s\S]*)$/);
    if (match) {
      messages.push({ role: match[1] as MessageRole, content: match[2].trim() });
    }
  }
  return messages.length > 0 ? messages : undefined;
}

const recordSectionMap = {
  userAnswer: ['我的作答', 'My Answer'],
  aiFeedback: ['AI 反馈', 'AI Feedback'],
  optimizedVersion: ['优化版本', 'Optimized Version'],
  aiOptimizedVersion: ['AI 优化版本', 'AI Optimized Version'],
  issueList: ['问题清单', 'Issue List'],
  chatHistory: ['对话记录', 'Chat History'],
};

const questionSectionMap = {
  questionContent: ['题目', 'Question'],
  referenceAnswer: ['参考答案', 'Reference Answer'],
  commonErrors: ['常见错误点', 'Common Errors'],
};

function findSection(sections: Record<string, string>, possibleNames: string[]): string | undefined {
  for (const name of possibleNames) {
    if (sections[name] !== undefined) return sections[name];
  }
  return undefined;
}

function parseRecordFromMarkdown(text: string, filename: string): PracticeRecord {
  const parsed = parseFrontmatter(text);
  const data = parsed.data as Record<string, unknown>;

  if (!data.id || typeof data.id !== "string") {
    throw new Error(`${filename}: ${i18n.t('validation.missingId')}`);
  }
  if (!data.practicedAt || typeof data.practicedAt !== "string") {
    throw new Error(`${filename}: ${i18n.t('validation.missingPracticedAt')}`);
  }
  if (!data.questionId || typeof data.questionId !== "string") {
    throw new Error(`${filename}: ${i18n.t('validation.missingQuestionId')}`);
  }
  if (!data.framework || typeof data.framework !== "string") {
    throw new Error(`${filename}: ${i18n.t('validation.missingFramework')}`);
  }

  const body = parsed.content.trim();
  const sections: Record<string, string> = {};
  const allHeaders = Object.values(recordSectionMap).flat();
  const sectionRegex = new RegExp(`^##\\s+(${allHeaders.join('|')})\\s*$`, 'gm');
  const matches = Array.from(body.matchAll(sectionRegex));

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = (match.index ?? 0) + match[0].length;
    const end = i < matches.length - 1 ? (matches[i + 1].index ?? body.length) : body.length;
    sections[match[1]] = body.slice(start, end).trim();
  }

  const messages = tryParseJson<Message[]>(data.messages) ??
    (findSection(sections, recordSectionMap.chatHistory) ? parseMessagesFromSection(findSection(sections, recordSectionMap.chatHistory)!) : undefined);

  const issueListFromBody = findSection(sections, recordSectionMap.issueList)
    ? findSection(sections, recordSectionMap.issueList)!
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- ") || line.startsWith("* "))
        .map((line) => line.slice(2).trim())
    : undefined;

  const issueList = Array.isArray(data.issueList)
    ? data.issueList.map(String)
    : issueListFromBody;

  return {
    id: data.id,
    practicedAt: data.practicedAt,
    questionId: data.questionId,
    framework: data.framework,
    ...(typeof data.overallScore === "number" ? { overallScore: data.overallScore } : {}),
    ...(typeof data.attempt === "number" ? { attempt: data.attempt } : {}),
    ...(typeof data.durationSeconds === "number" ? { durationSeconds: data.durationSeconds } : {}),
    ...(data.dimensionScores ? { dimensionScores: tryParseJson<Record<string, number>>(data.dimensionScores) } : {}),
    ...(issueList ? { issueList } : {}),
    ...(findSection(sections, recordSectionMap.optimizedVersion) ? { optimizedAnswer: findSection(sections, recordSectionMap.optimizedVersion) } : {}),
    ...(findSection(sections, recordSectionMap.aiOptimizedVersion) ? { aiOptimizedVersion: findSection(sections, recordSectionMap.aiOptimizedVersion) } : {}),
    ...(findSection(sections, recordSectionMap.userAnswer) ? { userAnswer: findSection(sections, recordSectionMap.userAnswer) } : {}),
    ...(findSection(sections, recordSectionMap.aiFeedback) ? { aiFeedback: findSection(sections, recordSectionMap.aiFeedback) } : {}),
    ...(messages ? { messages } : {}),
  } as PracticeRecord;
}

function parseQuestionFromMarkdown(text: string, filename: string): Question {
  const parsed = parseFrontmatter(text);
  const data = parsed.data as Record<string, unknown>;

  if (!data.id || typeof data.id !== "string") {
    throw new Error(`${filename}: ${i18n.t('validation.missingId')}`);
  }
  if (!data.type || typeof data.type !== "string") {
    throw new Error(`${filename}: ${i18n.t('validation.missingType')}`);
  }
  if (!data.framework || typeof data.framework !== "string") {
    throw new Error(`${filename}: ${i18n.t('validation.missingFramework')}`);
  }

  const id = data.id;
  const body = parsed.content.trim();
  const sections: Record<string, string> = {};
  const allHeaders = Object.values(questionSectionMap).flat();
  const sectionRegex = new RegExp(`^##\\s+(${allHeaders.join('|')})\\s*$`, 'gm');
  const matches = Array.from(body.matchAll(sectionRegex));

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = (match.index ?? 0) + match[0].length;
    const end = i < matches.length - 1 ? (matches[i + 1].index ?? body.length) : body.length;
    sections[match[1]] = body.slice(start, end).trim();
  }

  return {
    id,
    type: data.type,
    framework: data.framework,
    ...(typeof data.title === "string" ? { title: data.title } : {}),
    ...(typeof data.prompt === "string" ? { prompt: data.prompt } : {}),
    ...(Array.isArray(data.tags)
      ? { tags: data.tags.map(String) }
      : {}),
    ...(typeof data.createdAt === "string"
      ? { createdAt: data.createdAt }
      : {}),
    ...(typeof data.difficulty === "string"
      ? { difficulty: data.difficulty }
      : {}),
    ...(typeof data.source === "string"
      ? { source: data.source }
      : {}),
    ...(typeof data.isMistake === "number"
      ? { isMistake: data.isMistake }
      : {}),
    ...(findSection(sections, questionSectionMap.questionContent)
      ? { content: findSection(sections, questionSectionMap.questionContent) }
      : { content: body }),
    ...(findSection(sections, questionSectionMap.referenceAnswer)
      ? { referenceAnswer: findSection(sections, questionSectionMap.referenceAnswer) }
      : {}),
    ...(findSection(sections, questionSectionMap.commonErrors)
      ? {
          commonErrors: findSection(sections, questionSectionMap.commonErrors)!
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("- ") || line.startsWith("* "))
            .map((line) => line.slice(2).trim()),
        }
      : {}),
  } as Question;
}

function parsePrinciplesMarkdown(text: string): Principle[] {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized.trim()) return [];

  const chunks = normalized.split("\n---\n");
  const principles: Principle[] = [];

  for (let i = 1; i < chunks.length; i += 2) {
    const fmChunk = chunks[i];
    const bodyChunk = chunks[i + 1] || "";
    const doc = `---\n${fmChunk}\n---${bodyChunk}`;
    const parsed = parseFrontmatter(doc);
    const data = parsed.data as Record<string, unknown>;
    if (!data.id || typeof data.id !== "string") continue;
    if (!data.title || typeof data.title !== "string") continue;
    principles.push({
      id: data.id,
      title: data.title,
      content: parsed.content.trim(),
      ...(Array.isArray(data.tags) ? { tags: data.tags.map(String) } : {}),
      ...(typeof data.createdAt === "string" ? { createdAt: data.createdAt } : {}),
      ...(typeof data.updatedAt === "string" ? { updatedAt: data.updatedAt } : {}),
    });
  }

  return principles;
}

function parseSinglePrincipleMarkdown(text: string, filename: string): Principle {
  const parsed = parseFrontmatter(text);
  const data = parsed.data as Record<string, unknown>;

  if (!data.id || typeof data.id !== "string") {
    throw new Error(`${filename}: ${i18n.t('validation.missingId')}`);
  }
  if (!data.title || typeof data.title !== "string") {
    throw new Error(`${filename}: ${i18n.t('validation.missingTitle')}`);
  }

  return {
    id: data.id,
    title: data.title,
    content: parsed.content.trim(),
    ...(Array.isArray(data.tags) ? { tags: data.tags.map(String) } : {}),
    ...(typeof data.createdAt === "string" ? { createdAt: data.createdAt } : {}),
    ...(typeof data.updatedAt === "string" ? { updatedAt: data.updatedAt } : {}),
  };
}

export function detectMarkdownType(text: string): "question" | "record" | "principle" {
  const parsed = parseFrontmatter(text);
  const data = parsed.data as Record<string, unknown>;

  if (data.questionId && data.practicedAt) return "record";
  if (data.title && (!data.type || !data.framework)) return "principle";
  return "question";
}

export async function importFromZip(
  zipBlob: Blob,
  existingQuestions: Question[],
  existingRecords: PracticeRecord[],
  existingPrinciples: Principle[],
  strategy: "overwrite" | "skip"
): Promise<ImportFullResult> {
  const zip = await JSZip.loadAsync(zipBlob);
  const questionMap = new Map(existingQuestions.map((q) => [q.id, q]));
  const recordMap = new Map(existingRecords.map((r) => [r.id, r]));
  const principleMap = new Map(existingPrinciples.map((p) => [p.id, p]));
  const result: ImportResult = { added: 0, skipped: 0, errors: [] };

  for (const [rawPath, fileObj] of Object.entries(zip.files)) {
    if (fileObj.dir) continue;
    const relativePath = rawPath.replace(/\\/g, "/");

    if (relativePath.startsWith("questions/") && relativePath.endsWith(".md")) {
      try {
        const text = await fileObj.async("text");
        const q = parseQuestionFromMarkdown(text, relativePath);
        if (questionMap.has(q.id)) {
          if (strategy === "skip") {
            result.skipped += 1;
            continue;
          }
          questionMap.set(q.id, q);
          result.added += 1;
        } else {
          questionMap.set(q.id, q);
          result.added += 1;
        }
      } catch (err) {
        result.errors.push(
          `${relativePath}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      continue;
    }

    if (relativePath.startsWith("records/") && relativePath.endsWith(".md")) {
      try {
        const text = await fileObj.async("text");
        const r = parseRecordFromMarkdown(text, relativePath);
        if (recordMap.has(r.id)) {
          if (strategy === "skip") {
            result.skipped += 1;
            continue;
          }
          recordMap.set(r.id, r);
          result.added += 1;
        } else {
          recordMap.set(r.id, r);
          result.added += 1;
        }
      } catch (err) {
        result.errors.push(
          `${relativePath}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      continue;
    }

    if (relativePath === "principles.md") {
      try {
        const text = await fileObj.async("text");
        const parsedPrinciples = parsePrinciplesMarkdown(text);
        for (const p of parsedPrinciples) {
          if (principleMap.has(p.id)) {
            if (strategy === "skip") {
              result.skipped += 1;
              continue;
            }
            principleMap.set(p.id, p);
            result.added += 1;
          } else {
            principleMap.set(p.id, p);
            result.added += 1;
          }
        }
      } catch (err) {
        result.errors.push(
          `${relativePath}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      continue;
    }

    if (relativePath === "weak-points.md") {
      continue;
    }

    result.errors.push(`${relativePath}: ${i18n.t('validation.unknownFileSkipped')}`);
  }

  return {
    questions: Array.from(questionMap.values()),
    records: Array.from(recordMap.values()),
    principles: Array.from(principleMap.values()),
    result,
  };
}

export async function importFromFiles(
  files: File[],
  existingQuestions: Question[],
  existingRecords: PracticeRecord[],
  existingPrinciples: Principle[],
  strategy: "overwrite" | "skip"
): Promise<ImportFullResult> {
  const mdFiles = files.filter((f) => f.name.endsWith(".md"));
  const zipFiles = files.filter((f) => f.name.endsWith(".zip"));

  const result: ImportResult = { added: 0, skipped: 0, errors: [] };
  const questionMap = new Map(existingQuestions.map((q) => [q.id, q]));
  const recordMap = new Map(existingRecords.map((r) => [r.id, r]));
  const principleMap = new Map(existingPrinciples.map((p) => [p.id, p]));

  for (const file of mdFiles) {
    try {
      const text = await file.text();
      const type = detectMarkdownType(text);

      if (type === "record") {
        const r = parseRecordFromMarkdown(text, file.name);
        if (recordMap.has(r.id)) {
          if (strategy === "skip") {
            result.skipped += 1;
            continue;
          }
          recordMap.set(r.id, r);
          result.added += 1;
        } else {
          recordMap.set(r.id, r);
          result.added += 1;
        }
      } else if (type === "principle") {
        const p = parseSinglePrincipleMarkdown(text, file.name);
        if (principleMap.has(p.id)) {
          if (strategy === "skip") {
            result.skipped += 1;
            continue;
          }
          principleMap.set(p.id, p);
          result.added += 1;
        } else {
          principleMap.set(p.id, p);
          result.added += 1;
        }
      } else {
        const q = parseQuestionFromMarkdown(text, file.name);
        if (questionMap.has(q.id)) {
          if (strategy === "skip") {
            result.skipped += 1;
            continue;
          }
          questionMap.set(q.id, q);
          result.added += 1;
        } else {
          questionMap.set(q.id, q);
          result.added += 1;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(
        `${file.name}: ${i18n.t('validation.parseFailed', { message })}`
      );
    }
  }

  for (const zipFile of zipFiles) {
    const zipResult = await importFromZip(
      zipFile,
      Array.from(questionMap.values()),
      Array.from(recordMap.values()),
      Array.from(principleMap.values()),
      strategy
    );
    zipResult.result.errors.forEach((e) => result.errors.push(e));
    result.added += zipResult.result.added;
    result.skipped += zipResult.result.skipped;
    for (const q of zipResult.questions) questionMap.set(q.id, q);
    for (const r of zipResult.records) recordMap.set(r.id, r);
    for (const p of zipResult.principles) principleMap.set(p.id, p);
  }

  return {
    questions: Array.from(questionMap.values()),
    records: Array.from(recordMap.values()),
    principles: Array.from(principleMap.values()),
    result,
  };
}
