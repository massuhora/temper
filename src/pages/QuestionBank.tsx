import { useEffect, useState, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { db } from "@/db"
import type { Question } from "@/types"
import { exportQuestionsToZip, exportSingleQuestionMarkdown } from "@/services/markdownExport"
import { BUILTIN_FRAMEWORKS } from "@/lib/frameworks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Download, Search, Trash2, Edit, Bookmark, BookmarkX, FileDown } from "lucide-react"
import { save } from "@tauri-apps/plugin-dialog"
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs"

interface QuestionBankProps {
  onStartPractice: (questionId: string, mode?: 'normal' | 'blind') => void
}

const fwTKey = (id: string) => id === 'logic-tree' ? 'logicTree' : id

function translateDifficulty(value: string | undefined, t: (key: string) => string) {
  if (!value) return "-"
  if (value === "易") return t("difficulty.easy")
  if (value === "中") return t("difficulty.medium")
  if (value === "难") return t("difficulty.hard")
  return value
}

function translateQuestionType(value: string | undefined, t: (key: string) => string) {
  if (!value) return value
  if (value === "诊断改错题") return t("questionType.diagnostic")
  if (value === "分类重构题") return t("questionType.categorization")
  if (value === "限时结构速写") return t("questionType.sketch")
  if (value === "自定义真题") return t("questionType.custom")
  return value
}

export function QuestionBank({ onStartPractice }: QuestionBankProps) {
  const { t } = useTranslation()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  const [frameworkFilter, setFrameworkFilter] = useState<string>("all")
  const [tagFilter, setTagFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [frameworkSelectValue, setFrameworkSelectValue] = useState<string>("")
  const [customFramework, setCustomFramework] = useState<string>("")

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadQuestions = useCallback(async () => {
    setLoading(true)
    const all = await db.getAllQuestions()
    setQuestions(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false

    const fetchQuestions = async () => {
      const all = await db.getAllQuestions()
      if (cancelled) return
      setQuestions(all)
      setLoading(false)
    }

    fetchQuestions()

    return () => {
      cancelled = true
    }
  }, [])

  const frameworks = useMemo(() => {
    const set = new Set(questions.map((q) => q.framework).filter(Boolean))
    return Array.from(set).sort()
  }, [questions])

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchFramework =
        frameworkFilter === "all" || q.framework === frameworkFilter
      const matchTag =
        tagFilter.trim() === "" ||
        (q.tags ?? []).some((t) =>
          t.toLowerCase().includes(tagFilter.trim().toLowerCase())
        )
      const matchSearch =
        searchQuery.trim() === "" ||
        (q.content ?? "").toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        q.id.toLowerCase().includes(searchQuery.trim().toLowerCase())
      return matchFramework && matchTag && matchSearch
    })
  }, [questions, frameworkFilter, tagFilter, searchQuery])

  const openNew = useCallback(() => {
    setEditingQuestion({
      id: "",
      type: "诊断改错题",
      framework: "",
      tags: [],
      difficulty: "中",
      title: "",
      prompt: "",
      source: "",
      content: "",
      referenceAnswer: "",
      commonErrors: [],
    })
    setFrameworkSelectValue("")
    setCustomFramework("")
    setIsFormOpen(true)
  }, [])

  const openEdit = useCallback((q: Question) => {
    setEditingQuestion({ ...q })
    const builtin = BUILTIN_FRAMEWORKS.find((f) => f.name === q.framework)
    if (builtin) {
      setFrameworkSelectValue(builtin.name)
      setCustomFramework("")
    } else {
      setFrameworkSelectValue("__custom__")
      setCustomFramework(q.framework || "")
    }
    setIsFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    setIsFormOpen(false)
    setEditingQuestion(null)
    setFrameworkSelectValue("")
    setCustomFramework("")
  }, [])

  const handleFrameworkSelectChange = useCallback((value: string) => {
    setFrameworkSelectValue(value)
    if (value !== "__custom__") {
      setCustomFramework("")
    }
  }, [])

  const selectedBuiltin = useMemo(() => {
    return BUILTIN_FRAMEWORKS.find((f) => f.name === frameworkSelectValue)
  }, [frameworkSelectValue])

  const handleSave = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!editingQuestion) return
      const form = e.currentTarget
      const formData = new FormData(form)

      const id = String(formData.get("id") ?? "").trim()
      const type = String(formData.get("type") ?? "诊断改错题").trim()
      const difficulty = String(formData.get("difficulty") ?? "中").trim()
      const title = String(formData.get("title") ?? "").trim()
      const prompt = String(formData.get("prompt") ?? "").trim()
      const source = String(formData.get("source") ?? "").trim()
      const content = String(formData.get("content") ?? "").trim()
      const referenceAnswer = String(formData.get("referenceAnswer") ?? "").trim()
      const tagsRaw = String(formData.get("tags") ?? "")
      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
      const commonErrorsRaw = String(formData.get("commonErrors") ?? "")
      const commonErrors = commonErrorsRaw
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean)
      const isMistake = formData.get("isMistake") === "1" ? 1 : 0

      const framework =
        frameworkSelectValue === "__custom__"
          ? customFramework.trim()
          : frameworkSelectValue

      const existing = questions.find((q) => q.id === id)
      if (existing && existing.id !== editingQuestion.id) {
        alert(t('bank.duplicateIdAlert'))
        return
      }

      const isEditing = Boolean(
        editingQuestion.id && questions.find((q) => q.id === editingQuestion.id)
      )

      if (isEditing) {
        await db.updateQuestion(editingQuestion.id, {
          type,
          framework,
          difficulty,
          title,
          prompt,
          source,
          content,
          referenceAnswer,
          tags,
          commonErrors,
          isMistake,
        })
      } else {
        await db.addQuestion({
          id,
          type,
          framework,
          difficulty,
          title,
          prompt,
          source,
          content,
          referenceAnswer,
          tags,
          commonErrors,
          isMistake,
        })
      }

      closeForm()
      await loadQuestions()
    },
    [editingQuestion, questions, frameworkSelectValue, customFramework, closeForm, loadQuestions, t]
  )

  const confirmDelete = useCallback(async () => {
    if (!deletingId) return
    await db.deleteQuestion(deletingId)
    setDeletingId(null)
    await loadQuestions()
  }, [deletingId, loadQuestions])

  const toggleMistake = useCallback(async (q: Question) => {
    await db.updateQuestion(q.id, {
      isMistake: q.isMistake === 1 ? 0 : 1,
    })
    await loadQuestions()
  }, [loadQuestions])

  const handleExport = useCallback(async () => {
    const all = await db.getAllQuestions()
    const blob = await exportQuestionsToZip(all)
    const path = await save({ defaultPath: `temper-questions-${new Date().toISOString().slice(0, 10)}.zip` })
    if (path) {
      const arrayBuffer = await blob.arrayBuffer()
      await writeFile(path, new Uint8Array(arrayBuffer))
    }
  }, [])

  const handleExportSingle = useCallback(async (q: Question) => {
    const markdown = exportSingleQuestionMarkdown(q)
    const path = await save({ defaultPath: `${q.id}.md` })
    if (path) {
      await writeTextFile(path, markdown)
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-[26px] font-bold leading-[1.05] tracking-[-0.022em] md:text-[32px]">
            {t('bank.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('bank.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="size-4" strokeWidth={1.5} />
            {t('bank.exportAll')}
          </Button>
          <Button onClick={openNew}>
            <Plus className="size-4" strokeWidth={1.5} />
            {t('bank.newQuestion')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="flex items-center gap-2 md:w-48">
          <select
            value={frameworkFilter}
            onChange={(e) => setFrameworkFilter(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="all">{t('bank.allFrameworks')}</option>
            {frameworks.map((f) => {
              const builtin = BUILTIN_FRAMEWORKS.find((bf) => bf.name === f)
              const label = builtin ? t(`framework.${fwTKey(builtin.id)}.name`) : f
              return (
                <option key={f} value={f}>
                  {label}
                </option>
              )
            })}
          </select>
        </div>
        <div className="flex items-center gap-2 md:w-48">
          <Input
            placeholder={t('bank.filterTags')}
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          />
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
          <Input
            placeholder={t('bank.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : filteredQuestions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          {t('bank.noResults')}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredQuestions.map((q) => {
            const fwBuiltin = BUILTIN_FRAMEWORKS.find((bf) => bf.name === q.framework)
            const fwLabel = fwBuiltin ? t(`framework.${fwTKey(fwBuiltin.id)}.name`) : q.framework
            return (
              <Card
                key={q.id}
                className="cursor-pointer bg-card shadow-elevation-2 transition-transform active:scale-95"
                onClick={() => onStartPractice(q.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[11px]">
                        {q.id}
                      </Badge>
                      <Badge variant="secondary" className="text-[11px]">
                        {fwLabel}
                      </Badge>
                      {q.type ? (
                        <Badge variant="ghost" className="text-[11px]">
                          {translateQuestionType(q.type, t)}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {translateDifficulty(q.difficulty, t)}
                    </span>
                  </div>
                  <CardTitle className="mt-2 font-display text-base font-semibold">
                    {q.title || q.content?.slice(0, 120) || t('bank.noContent')}
                    {!q.title && (q.content?.length || 0) > 120 ? "…" : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mb-3 flex flex-wrap gap-1">
                    {(q.tags || []).map((t) => (
                      <Badge key={t} variant="ghost" className="text-[11px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={q.isMistake === 1 ? "secondary" : "outline"}
                      onClick={(e) => {
                        e.stopPropagation()
                        void toggleMistake(q)
                      }}
                    >
                      {q.isMistake === 1 ? (
                        <>
                          <BookmarkX className="size-3.5" strokeWidth={1.5} />
                          {t('bank.unmarkMistake')}
                        </>
                      ) : (
                        <>
                          <Bookmark className="size-3.5" strokeWidth={1.5} />
                          {t('bank.markMistake')}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(q)
                      }}
                    >
                      <Edit className="size-3.5" strokeWidth={1.5} />
                      {t('common.edit')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleExportSingle(q)
                      }}
                    >
                      <FileDown className="size-3.5" strokeWidth={1.5} />
                      {t('common.export')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingId(q.id)
                      }}
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.5} />
                      {t('common.delete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold">
              {editingQuestion?.id && questions.some((q) => q.id === editingQuestion.id)
                ? t('bank.form.editTitle')
                : t('bank.form.newTitle')}
            </DialogTitle>
          </DialogHeader>
          {editingQuestion && (
            <form id="question-form" onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="q-id">{t('bank.form.id')}</Label>
                <Input
                  id="q-id"
                  name="id"
                  required
                  defaultValue={editingQuestion.id}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q-type">{t('bank.form.type')}</Label>
                <select
                  id="q-type"
                  name="type"
                  required
                  defaultValue={editingQuestion.type || "诊断改错题"}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="诊断改错题">{t('questionType.diagnostic')}</option>
                  <option value="分类重构题">{t('questionType.categorization')}</option>
                  <option value="限时结构速写">{t('questionType.sketch')}</option>
                  <option value="自定义真题">{t('questionType.custom')}</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q-framework">{t('bank.form.framework')}</Label>
                <select
                  id="q-framework"
                  name="framework"
                  required
                  value={frameworkSelectValue}
                  onChange={(e) => handleFrameworkSelectChange(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">{t('bank.form.selectFramework')}</option>
                  {BUILTIN_FRAMEWORKS.map((f) => (
                    <option key={f.id} value={f.name}>
                      {t(`framework.${fwTKey(f.id)}.name`)}
                    </option>
                  ))}
                  <option value="__custom__">{t('bank.form.customFramework')}</option>
                </select>
                {frameworkSelectValue === "__custom__" && (
                  <Input
                    placeholder={t('bank.form.customFrameworkPlaceholder')}
                    value={customFramework}
                    onChange={(e) => setCustomFramework(e.target.value)}
                    required
                  />
                )}
                {selectedBuiltin && (
                  <p className="text-xs text-muted-foreground">
                    {t(`framework.${fwTKey(selectedBuiltin.id)}.focus`)}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q-title">{t('bank.form.titleLabel')}</Label>
                <Input
                  id="q-title"
                  name="title"
                  defaultValue={editingQuestion.title}
                  placeholder={t('bank.form.titlePlaceholder')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q-prompt">{t('bank.form.prompt')}</Label>
                <Textarea
                  id="q-prompt"
                  name="prompt"
                  rows={2}
                  defaultValue={editingQuestion.prompt}
                  placeholder={t('bank.form.promptPlaceholder')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q-source">{t('bank.form.source')}</Label>
                <Input
                  id="q-source"
                  name="source"
                  defaultValue={editingQuestion.source}
                  placeholder={t('bank.form.sourcePlaceholder')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q-tags">{t('bank.form.tags')}</Label>
                <Input
                  id="q-tags"
                  name="tags"
                  defaultValue={(editingQuestion.tags || []).join(", ")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q-difficulty">{t('bank.form.difficulty')}</Label>
                <select
                  id="q-difficulty"
                  name="difficulty"
                  required
                  defaultValue={editingQuestion.difficulty || "中"}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="易">{t('difficulty.easy')}</option>
                  <option value="中">{t('difficulty.medium')}</option>
                  <option value="难">{t('difficulty.hard')}</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q-content">{t('bank.form.content')}</Label>
                <Textarea
                  id="q-content"
                  name="content"
                  rows={4}
                  defaultValue={editingQuestion.content}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q-reference">{t('bank.form.referenceAnswer')}</Label>
                <Textarea
                  id="q-reference"
                  name="referenceAnswer"
                  rows={3}
                  defaultValue={editingQuestion.referenceAnswer}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q-errors">{t('bank.form.commonErrors')}</Label>
                <Textarea
                  id="q-errors"
                  name="commonErrors"
                  rows={3}
                  defaultValue={(editingQuestion.commonErrors || []).join("\n")}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="q-mistake"
                  name="isMistake"
                  type="checkbox"
                  value="1"
                  defaultChecked={editingQuestion.isMistake === 1}
                  className="size-4 rounded border-border"
                />
                <Label htmlFor="q-mistake" className="font-normal">
                  {t('bank.form.isMistake')}
                </Label>
              </div>
            </form>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={closeForm}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="question-form">
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold">{t('bank.deleteConfirm.title')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('bank.deleteConfirm.body', { id: deletingId || '' })}
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDeletingId(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
