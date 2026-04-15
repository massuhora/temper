type FrontmatterValue = string | number | boolean | string[] | undefined

export interface FrontmatterResult {
  data: Record<string, FrontmatterValue>
  content: string
}

export function parseFrontmatter(source: string): FrontmatterResult {
  const normalized = source.replace(/\r\n/g, "\n")

  if (!normalized.startsWith("---\n")) {
    return {
      data: {},
      content: normalized,
    }
  }

  const endIndex = normalized.indexOf("\n---\n", 4)
  if (endIndex === -1) {
    return {
      data: {},
      content: normalized,
    }
  }

  const rawFrontmatter = normalized.slice(4, endIndex).trim()
  const content = normalized.slice(endIndex + 5)

  return {
    data: parseFrontmatterBlock(rawFrontmatter),
    content,
  }
}

export function stringifyFrontmatter(
  content: string,
  data: Record<string, FrontmatterValue>
): string {
  const lines = Object.entries(data)
    .filter(hasFrontmatterValue)
    .map(([key, value]) => `${key}: ${formatFrontmatterValue(value)}`)

  if (lines.length === 0) {
    return content
  }

  return `---\n${lines.join("\n")}\n---\n\n${content.trim()}\n`
}

function parseFrontmatterBlock(block: string): Record<string, FrontmatterValue> {
  const data: Record<string, FrontmatterValue> = {}

  for (const line of block.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const separatorIndex = trimmed.indexOf(":")
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    data[key] = parseFrontmatterValue(rawValue)
  }

  return data
}

function hasFrontmatterValue(
  entry: [string, FrontmatterValue]
): entry is [string, Exclude<FrontmatterValue, undefined>] {
  return entry[1] !== undefined
}

function parseFrontmatterValue(value: string): FrontmatterValue {
  if (!value) return ""

  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim()
    if (!inner) return []
    return inner
      .split(",")
      .map((item) => stripQuotes(item.trim()))
      .filter(Boolean)
  }

  if (value === "true") return true
  if (value === "false") return false

  const numeric = Number(value)
  if (!Number.isNaN(numeric) && value !== "") {
    return numeric
  }

  return stripQuotes(value)
}

function formatFrontmatterValue(value: Exclude<FrontmatterValue, undefined>): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => escapeInlineValue(item)).join(", ")}]`
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return String(value)
  }

  return escapeInlineValue(value)
}

function escapeInlineValue(value: string): string {
  return /[[\],:#]|^\s|\s$/.test(value) ? JSON.stringify(value) : value
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}
