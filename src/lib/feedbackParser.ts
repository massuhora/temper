export function parseDimensionScores(text: string): Record<string, number> {
  const map: Record<string, number> = {};
  const lines = text.split("\n");
  let inSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+/.test(trimmed)) {
      if (inSection) break;
      if (/^##\s+(维度评分|Dimension Scores)/.test(trimmed)) {
        inSection = true;
        continue;
      }
    }
    if (!inSection) continue;
    if (trimmed.startsWith("|")) {
      const cells = trimmed
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length >= 2) {
        const dim = cells[0];
        const score = parseFloat(cells[1]);
        if (!Number.isNaN(score) && dim && dim !== "维度" && dim !== "Dimension" && !/^[-:]+$/.test(dim)) {
          map[dim] = score;
        }
      }
    }
  }
  return map;
}

export function parseIssueList(text: string): string[] {
  const issues: string[] = [];
  const lines = text.split("\n");
  let inSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+/.test(trimmed)) {
      if (inSection) break;
      if (/^##\s+(结构问题清单|问题清单|Issue List)/.test(trimmed)) {
        inSection = true;
        continue;
      }
    }
    if (!inSection) continue;
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      issues.push(trimmed.slice(2).trim());
    }
  }
  return issues;
}

export function parseOptimizedAnswer(text: string): string | undefined {
  const lines = text.split("\n");
  let inSection = false;
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+/.test(trimmed)) {
      if (inSection) break;
      if (/^##\s+(优化版本|Optimized Version)/.test(trimmed)) {
        inSection = true;
        continue;
      }
    }
    if (!inSection) continue;
    result.push(line);
  }
  const answer = result.join("\n").trim();
  return answer || undefined;
}

export function parseOverallScore(dimensionScores: Record<string, number>): number {
  const values = Object.values(dimensionScores);
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg * 10) / 10;
}
