import i18n from "@/i18n";
import type { PracticeRecord } from "@/types";

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return formatDate(d);
}

function getMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function calcActiveDays(records: PracticeRecord[]): number {
  const dates = new Set(records.map((r) => r.practicedAt.slice(0, 10)));
  return dates.size;
}

export function calcWeeklyTrend(
  records: PracticeRecord[]
): { week: string; count: number; avgScore: number }[] {
  const groups: Record<string, { count: number; sum: number }> = {};
  for (const r of records) {
    const key = getWeekKey(new Date(r.practicedAt));
    if (!groups[key]) groups[key] = { count: 0, sum: 0 };
    groups[key].count += 1;
    groups[key].sum += r.overallScore ?? 0;
  }
  const weeks = Object.entries(groups)
    .map(([week, { count, sum }]) => ({
      week,
      count,
      avgScore: Math.round((sum / count) * 10) / 10,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
  return weeks.slice(-8);
}

export function calcMonthlyTrend(
  records: PracticeRecord[]
): { month: string; count: number; avgScore: number }[] {
  const groups: Record<string, { count: number; sum: number }> = {};
  for (const r of records) {
    const key = getMonthKey(new Date(r.practicedAt));
    if (!groups[key]) groups[key] = { count: 0, sum: 0 };
    groups[key].count += 1;
    groups[key].sum += r.overallScore ?? 0;
  }
  const months = Object.entries(groups)
    .map(([month, { count, sum }]) => ({
      month,
      count,
      avgScore: Math.round((sum / count) * 10) / 10,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return months.slice(-6);
}

export function calcFrameworkAverages(
  records: PracticeRecord[]
): { framework: string; avg: number; count: number }[] {
  const groups: Record<string, { sum: number; count: number }> = {};
  for (const r of records) {
    const fw = r.framework || i18n.t("stats.uncategorized");
    if (!groups[fw]) groups[fw] = { sum: 0, count: 0 };
    groups[fw].sum += r.overallScore ?? 0;
    groups[fw].count += 1;
  }
  return Object.entries(groups)
    .map(([framework, { sum, count }]) => ({
      framework,
      avg: Math.round((sum / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => b.avg - a.avg);
}

export function calcTopIssues(
  records: PracticeRecord[],
  topN = 5
): { issue: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const r of records) {
    for (const issue of r.issueList || []) {
      if (!issue.trim()) continue;
      counts[issue] = (counts[issue] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}
