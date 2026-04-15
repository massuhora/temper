import type { PracticeRecord, Question } from "@/types"

export function getWeakDimension(
  records: PracticeRecord[]
): { dimension: string; avg: number } | null {
  if (records.length === 0) return null
  const sums: Record<string, { sum: number; count: number }> = {}
  for (const record of records) {
    const scores = record.dimensionScores || {}
    for (const [dim, score] of Object.entries(scores)) {
      if (!sums[dim]) sums[dim] = { sum: 0, count: 0 }
      sums[dim].sum += score
      sums[dim].count += 1
    }
  }
  const dims = Object.entries(sums)
  if (dims.length === 0) return null
  let weakest: { dimension: string; avg: number } | null = null
  for (const [dim, { sum, count }] of dims) {
    const avg = sum / count
    if (!weakest || avg < weakest.avg) {
      weakest = { dimension: dim, avg }
    }
  }
  return weakest
}

export function getWeakFramework(
  records: PracticeRecord[]
): { framework: string; avg: number } | null {
  if (records.length === 0) return null
  const sums: Record<string, { sum: number; count: number }> = {}
  for (const record of records) {
    const fw = record.framework
    if (!fw) continue
    if (!sums[fw]) sums[fw] = { sum: 0, count: 0 }
    sums[fw].sum += record.overallScore ?? 0
    sums[fw].count += 1
  }
  const fws = Object.entries(sums)
  if (fws.length === 0) return null
  let weakest: { framework: string; avg: number } | null = null
  for (const [fw, { sum, count }] of fws) {
    const avg = sum / count
    if (!weakest || avg < weakest.avg) {
      weakest = { framework: fw, avg }
    }
  }
  return weakest
}

export function recommendWeakPointQuestions(
  records: PracticeRecord[],
  questions: Question[],
  limit = 5
): Question[] {
  if (records.length === 0 || questions.length === 0) return []

  const weakDim = getWeakDimension(records)
  let result: Question[] = []

  if (weakDim) {
    const dimLower = weakDim.dimension.toLowerCase()
    result = questions.filter((q) => {
      const tagsMatch = q.tags?.some(
        (t) =>
          t.toLowerCase().includes(dimLower) ||
          dimLower.includes(t.toLowerCase())
      )
      const fwMatch =
        q.framework?.toLowerCase().includes(dimLower) ||
        dimLower.includes(q.framework?.toLowerCase() || "")
      return tagsMatch || fwMatch
    })
  }

  if (result.length < limit) {
    const weakFw = getWeakFramework(records)
    if (weakFw) {
      const fwLower = weakFw.framework.toLowerCase()
      const fwMatches = questions.filter((q) => {
        if (result.some((r) => r.id === q.id)) return false
        const qFw = q.framework?.toLowerCase() || ""
        return (
          qFw === fwLower || qFw.includes(fwLower) || fwLower.includes(qFw)
        )
      })
      result = [...result, ...fwMatches]
    }
  }

  return result.slice(0, limit)
}
