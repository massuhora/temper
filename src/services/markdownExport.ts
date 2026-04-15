import JSZip from "jszip";
import i18n from "@/i18n";
import { stringifyFrontmatter } from "@/lib/frontmatter";
import type { PracticeRecord, Question, Principle } from "../types";

function tryStringify(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function formatRecordBody(record: PracticeRecord): string {
  const parts: string[] = [];
  if (record.userAnswer) parts.push(`## ${i18n.t('export.userAnswerSection')}\n\n${record.userAnswer}`);
  if (record.aiFeedback) parts.push(`## ${i18n.t('export.aiFeedbackSection')}\n\n${record.aiFeedback}`);
  if (record.optimizedAnswer) parts.push(`## ${i18n.t('export.optimizedVersionSection')}\n\n${record.optimizedAnswer}`);
  if (record.aiOptimizedVersion) parts.push(`## ${i18n.t('export.aiOptimizedVersionSection')}\n\n${record.aiOptimizedVersion}`);
  if (record.issueList && record.issueList.length > 0) {
    parts.push(`## ${i18n.t('export.issueListSection')}\n\n${record.issueList.map((i) => `- ${i}`).join("\n")}`);
  }
  if (record.messages && record.messages.length > 0) {
    const readableMessages = record.messages
      .map((m) => `**${m.role}**: ${m.content}`)
      .join("\n\n");
    parts.push(`## ${i18n.t('export.chatHistorySection')}\n\n${readableMessages}`);
  }
  return parts.join("\n\n");
}

export function questionToMarkdown(question: Question): string {
  const data: Record<string, string | number | boolean | string[] | undefined> = {
    id: question.id,
    type: question.type,
    framework: question.framework,
    ...(question.title ? { title: question.title } : {}),
    ...(question.prompt ? { prompt: question.prompt } : {}),
    ...(question.tags && question.tags.length > 0 ? { tags: question.tags } : {}),
    ...(question.createdAt ? { createdAt: question.createdAt } : {}),
    ...(question.difficulty ? { difficulty: question.difficulty } : {}),
    ...(question.source ? { source: question.source } : {}),
    ...(question.isMistake !== undefined ? { isMistake: question.isMistake } : {}),
  };

  const bodyParts: string[] = [];
  if (question.content) bodyParts.push(`## ${i18n.t('export.questionSection')}\n\n${question.content}`);
  if (question.referenceAnswer) bodyParts.push(`## ${i18n.t('export.referenceAnswerSection')}\n\n${question.referenceAnswer}`);
  if (question.commonErrors && question.commonErrors.length > 0) {
    bodyParts.push(
      `## ${i18n.t('export.commonErrorsSection')}\n\n${question.commonErrors.map((e) => `- ${e}`).join("\n")}`
    );
  }

  return stringifyFrontmatter(bodyParts.join("\n\n"), data);
}

export function exportSingleQuestionMarkdown(question: Question): string {
  return questionToMarkdown(question);
}

export async function exportQuestionsToZip(questions: Question[]): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder("questions");
  if (!folder) throw new Error("Failed to create zip folder");

  for (const q of questions) {
    folder.file(`${q.id}.md`, questionToMarkdown(q));
  }

  return zip.generateAsync({ type: "blob" });
}

export function exportQuestionsToFolder(
  questions: Question[]
): { filename: string; content: string }[] {
  return questions.map((q) => ({
    filename: `questions/${q.id}.md`,
    content: questionToMarkdown(q),
  }));
}

function recordToMarkdown(record: PracticeRecord): string {
  const data: Record<string, string | number | boolean | string[] | undefined> = {
    id: record.id,
    practicedAt: record.practicedAt,
    questionId: record.questionId,
    framework: record.framework,
    ...(record.overallScore !== undefined ? { overallScore: record.overallScore } : {}),
    ...(record.attempt !== undefined ? { attempt: record.attempt } : {}),
    ...(record.durationSeconds !== undefined ? { durationSeconds: record.durationSeconds } : {}),
    ...(record.dimensionScores ? { dimensionScores: tryStringify(record.dimensionScores) } : {}),
    ...(record.issueList && record.issueList.length > 0 ? { issueList: record.issueList } : {}),
  };

  return stringifyFrontmatter(formatRecordBody(record), data);
}

export function exportMistakesToMarkdown(
  questions: Question[],
  records: PracticeRecord[]
): string {
  const mistakeRecords = records
    .filter((r) => (r.overallScore ?? 0) < 6)
    .sort(
      (a, b) =>
        new Date(b.practicedAt).getTime() - new Date(a.practicedAt).getTime()
    );

  const lines: string[] = [
    `# ${i18n.t('export.mistakeNotebookTitle')}`,
    "",
    `> ${i18n.t('common.generatedAt')} ${new Date().toISOString().slice(0, 10)}`,
    "",
    "---",
    "",
  ];

  for (const record of mistakeRecords) {
    const question = questions.find((q) => q.id === record.questionId);
    lines.push(
      `## ${question?.title || question?.id || record.questionId} — ${
        question?.framework || record.framework || i18n.t('export.unknownFramework')
      }`
    );
    lines.push("");
    lines.push(`- **${i18n.t('export.practiceTime')}**: ${record.practicedAt}`);
    lines.push(`- **${i18n.t('export.totalScore')}**: ${record.overallScore ?? "-"}`);
    lines.push(`- **${i18n.t('export.attempt')}**: ${record.attempt ?? 1}`);
    if (record.durationSeconds !== undefined) {
      lines.push(`- **${i18n.t('export.durationSeconds')}**: ${record.durationSeconds}`);
    }
    if (record.dimensionScores && Object.keys(record.dimensionScores).length > 0) {
      lines.push(`- **${i18n.t('export.dimensionScores')}**: ${JSON.stringify(record.dimensionScores)}`);
    }
    if (record.issueList && record.issueList.length > 0) {
      lines.push(`- **${i18n.t('export.issue')}**: ${record.issueList.join("；")}`);
    }
    lines.push("");

    if (record.userAnswer) {
      lines.push(`### ${i18n.t('export.userAnswerSection')}`);
      lines.push("");
      lines.push(record.userAnswer);
      lines.push("");
    }

    if (record.aiFeedback) {
      lines.push(`### ${i18n.t('export.aiFeedbackSection')}`);
      lines.push("");
      lines.push(record.aiFeedback);
      lines.push("");
    }

    if (record.optimizedAnswer) {
      lines.push(`### ${i18n.t('export.optimizedVersionSection')}`);
      lines.push("");
      lines.push(record.optimizedAnswer);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

export function generateWeakPointsMarkdown(
  records: PracticeRecord[],
  questions: Question[]
): string {
  void questions;
  const scoredRecords = records.filter(
    (r) => r.overallScore !== undefined && r.dimensionScores && Object.keys(r.dimensionScores).length > 0
  );

  const dimensionTotals: Record<string, { sum: number; count: number }> = {};
  const frameworkTotals: Record<string, { sum: number; count: number }> = {};

  for (const r of scoredRecords) {
    if (r.framework) {
      if (!frameworkTotals[r.framework]) frameworkTotals[r.framework] = { sum: 0, count: 0 };
      frameworkTotals[r.framework].sum += r.overallScore!;
      frameworkTotals[r.framework].count += 1;
    }

    for (const [dim, score] of Object.entries(r.dimensionScores!)) {
      if (!dimensionTotals[dim]) dimensionTotals[dim] = { sum: 0, count: 0 };
      dimensionTotals[dim].sum += score;
      dimensionTotals[dim].count += 1;
    }
  }

  const dimensionAvgs = Object.entries(dimensionTotals)
    .map(([name, { sum, count }]) => ({ name, avg: sum / count }))
    .sort((a, b) => a.avg - b.avg);

  const frameworkAvgs = Object.entries(frameworkTotals)
    .map(([name, { sum, count }]) => ({ name, avg: sum / count }))
    .sort((a, b) => a.avg - b.avg);

  const lowestDimension = dimensionAvgs[0];
  const lowestFramework = frameworkAvgs[0];

  const lines: string[] = [
    `# ${i18n.t('export.weakPointReportTitle')}`,
    "",
    `> ${i18n.t('common.generatedAt')} ${new Date().toISOString().slice(0, 10)}`,
    "",
    `## ${i18n.t('export.dimensionAverage')}`,
    "",
  ];

  for (const d of dimensionAvgs) {
    lines.push(`- **${d.name}**: ${d.avg.toFixed(2)}`);
  }

  lines.push("");
  lines.push(`## ${i18n.t('export.lowestDimension')}`);
  lines.push("");
  if (lowestDimension) {
    lines.push(`- **${lowestDimension.name}**: ${lowestDimension.avg.toFixed(2)}`);
  } else {
    lines.push(i18n.t('export.noData'));
  }

  lines.push("");
  lines.push(`## ${i18n.t('export.frameworkMastery')}`);
  lines.push("");
  for (const f of frameworkAvgs) {
    lines.push(`- **${f.name}**: ${f.avg.toFixed(2)} (${frameworkTotals[f.name].count} ${i18n.t('common.count')})`);
  }

  lines.push("");
  lines.push(`## ${i18n.t('export.lowestFramework')}`);
  lines.push("");
  if (lowestFramework) {
    lines.push(`- **${lowestFramework.name}**: ${lowestFramework.avg.toFixed(2)}`);
  } else {
    lines.push(i18n.t('export.noData'));
  }

  return lines.join("\n");
}

export async function exportFullBackupZip(
  questions: Question[],
  records: PracticeRecord[],
  principles: Principle[],
  weakPointsMarkdown: string
): Promise<Blob> {
  const zip = new JSZip();

  const questionsFolder = zip.folder("questions");
  if (questionsFolder) {
    for (const q of questions) {
      questionsFolder.file(`${q.id}.md`, questionToMarkdown(q));
    }
  }

  const recordsByMonth = new Map<string, PracticeRecord[]>();
  for (const r of records) {
    const month = r.practicedAt.slice(0, 7);
    if (!recordsByMonth.has(month)) recordsByMonth.set(month, []);
    recordsByMonth.get(month)!.push(r);
  }

  for (const [month, monthRecords] of recordsByMonth) {
    const folder = zip.folder(`records/${month}`);
    if (folder) {
      for (const r of monthRecords) {
        folder.file(`${r.id}.md`, recordToMarkdown(r));
      }
    }
  }

  const principlesMd = principles
    .map((p) => {
      const data = {
        id: p.id,
        title: p.title,
        ...(p.tags && p.tags.length > 0 ? { tags: p.tags } : {}),
        ...(p.createdAt ? { createdAt: p.createdAt } : {}),
        ...(p.updatedAt ? { updatedAt: p.updatedAt } : {}),
      };
      return stringifyFrontmatter(p.content, data);
    })
    .join("\n")
    .trim();

  zip.file("principles.md", principlesMd ? principlesMd + "\n" : "");
  zip.file("weak-points.md", weakPointsMarkdown);

  return zip.generateAsync({ type: "blob" });
}
