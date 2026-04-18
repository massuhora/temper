import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getStructuredThinkingHandbook } from "@/lib/knowledgeBase"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useTranslation } from "react-i18next"

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-4 mt-6 font-display text-2xl font-bold tracking-tight text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3 mt-6 font-display text-xl font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-5 font-display text-lg font-semibold tracking-tight text-foreground">
      {children}
    </h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mb-2 mt-4 text-base font-semibold text-foreground">
      {children}
    </h4>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-4 text-sm leading-7 text-foreground/90 break-words">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-4 ml-5 list-disc space-y-2 text-sm leading-7 text-foreground/90">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-4 ml-5 list-decimal space-y-2 text-sm leading-7 text-foreground/90">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="pl-1 marker:text-muted-foreground">{children}</li>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="mb-4 border-l-2 border-primary/60 bg-accent/40 py-2 pl-4 pr-3 text-sm italic text-foreground/80">
      {children}
    </blockquote>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-foreground/90">{children}</em>
  ),
  hr: () => <Separator className="my-6" />,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-accent text-accent-foreground">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-border bg-card">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="transition-colors even:bg-accent/20">{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-2 text-foreground/90">{children}</td>
  ),
}

export function KnowledgeBase() {
  const { t, i18n } = useTranslation()
  const [activeIndex, setActiveIndex] = React.useState(0)
  const handbook = React.useMemo(
    () => getStructuredThinkingHandbook(t),
    [t, i18n.language]
  )
  const activeChapter = handbook.chapters[activeIndex]

  return (
    <div className="flex h-[calc(100vh-88px)] flex-col gap-4 md:h-[calc(100vh-48px)]">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {t("knowledge.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("knowledge.subtitle")}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        {/* Chapter List — Desktop left / Mobile top scroll */}
        <div className="shrink-0 md:w-60">
          <ScrollArea className="h-full w-full rounded-lg border border-border bg-card p-2 md:p-3">
            <div className="flex gap-2 md:flex-col">
              {handbook.chapters.map((chapter, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    "flex shrink-0 items-center justify-start rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                    activeIndex === idx
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <span className="mr-2 tabular-nums opacity-60">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate">{chapter.title}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card p-4 md:p-6">
          <ScrollArea className="min-h-0 w-full flex-1 pr-2">
            <article className="w-full max-w-3xl break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {`# ${activeChapter.title}\n\n${activeChapter.content}`}
              </ReactMarkdown>
            </article>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
