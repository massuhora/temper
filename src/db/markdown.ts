import i18n from "@/i18n";
import { parseFrontmatter, stringifyFrontmatter } from "@/lib/frontmatter";
import type { Question } from "../types";

export function questionToMarkdown(q: Question): string {
  const frontmatter = {
    id: q.id,
    type: q.type,
    framework: q.framework,
    tags: q.tags,
    createdAt: q.createdAt,
    difficulty: q.difficulty,
    isMistake: Boolean(q.isMistake),
  };

  const parts: string[] = [];

  parts.push(`## ${i18n.t('export.questionSection')}`);
  parts.push("");
  parts.push(q.content || "");
  parts.push("");

  parts.push(`## ${i18n.t('export.referenceAnswerSection')}`);
  parts.push("");
  parts.push(q.referenceAnswer || "");
  parts.push("");

  parts.push(`## ${i18n.t('export.commonErrorsSection')}`);
  parts.push("");
  if (q.commonErrors && q.commonErrors.length > 0) {
    for (const err of q.commonErrors) {
      parts.push(`- ${err}`);
    }
  }
  parts.push("");

  return stringifyFrontmatter(parts.join("\n"), frontmatter);
}

export function markdownToQuestion(md: string): Question {
  const parsed = parseFrontmatter(md);
  const data = parsed.data as Record<string, unknown>;
  const body = parsed.content;

  const content = extractSection(body, [
    i18n.t('export.questionSection'),
    "题目",
    "Question",
  ]) || body.trim();

  const referenceAnswer = extractSection(body, [
    i18n.t('export.referenceAnswerSection'),
    "参考答案",
    "Reference Answer",
  ]);

  const commonErrorsRaw = extractSection(body, [
    i18n.t('export.commonErrorsSection'),
    "常见错误点",
    "Common Errors",
  ]);

  const commonErrors = commonErrorsRaw
    ? commonErrorsRaw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- ") || line.startsWith("* "))
        .map((line) => line.slice(2).trim())
        .filter(Boolean)
    : undefined;

  return {
    id: String(data.id ?? ""),
    type: String(data.type ?? "诊断改错") as "诊断改错",
    framework: String(data.framework ?? ""),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    createdAt: String(data.createdAt ?? new Date().toISOString().slice(0, 10)),
    difficulty: String(data.difficulty ?? "中") as "易" | "中" | "难",
    content,
    referenceAnswer,
    commonErrors,
    isMistake: data.isMistake ? 1 : 0,
  };
}

function extractSection(markdown: string, titles: string[]): string | undefined {
  const lines = markdown.split("\n");
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    if (titles.some((t) => lines[i].trim() === `## ${t}`)) {
      start = i;
      break;
    }
  }

  if (start === -1) return undefined;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith("## ")) {
      end = i;
      break;
    }
  }

  return lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
}
