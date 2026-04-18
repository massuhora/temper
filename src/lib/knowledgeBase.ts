export interface HandbookChapter {
  title: string
  content: string
}

export interface KnowledgeHandbook {
  title: string
  description: string
  chapters: HandbookChapter[]
}

export const knowledgeChapterKeys = [
  "intro",
  "ch1",
  "ch2",
  "ch3",
  "ch4",
  "conclusion",
] as const

export function getStructuredThinkingHandbook(
  translate: (key: string) => string
): KnowledgeHandbook {
  return {
    title: translate("knowledge.title"),
    description: translate("knowledge.subtitle"),
    chapters: knowledgeChapterKeys.map((key) => ({
      title: translate(`knowledge.handbook.chapters.${key}.title`),
      content: translate(`knowledge.handbook.chapters.${key}.content`),
    })),
  }
}
