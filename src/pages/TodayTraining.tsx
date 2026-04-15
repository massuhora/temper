import { useEffect, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { db } from "@/db"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Flame, Shuffle, Target, LayoutTemplate, Zap, Eye } from "lucide-react"
import type { Question } from "@/types"
import {
  recommendWeakPointQuestions,
  getWeakDimension,
  getWeakFramework,
} from "@/lib/trainingRecommendation"
import { BUILTIN_FRAMEWORKS } from "@/lib/frameworks"
import { generateSketchQuestion } from "@/lib/sketchTopics"
import { toast } from "sonner"

interface TodayTrainingProps {
  onStartPractice: (questionId: string, mode?: 'normal' | 'blind') => void
}

const fwTKey = (id: string) => id === 'logic-tree' ? 'logicTree' : id

export function TodayTraining({ onStartPractice }: TodayTrainingProps) {
  const { t } = useTranslation()
  const [mistakeQuestions, setMistakeQuestions] = useState<string[]>([])
  const [totalQuestions, setTotalQuestions] = useState<string[]>([])
  const [weakQuestions, setWeakQuestions] = useState<Question[]>([])
  const [weakLabel, setWeakLabel] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [allQuestions, setAllQuestions] = useState<Question[]>([])

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      const [mistakes, all, records] = await Promise.all([
        db.getMistakeQuestions(),
        db.getAllQuestions(),
        db.getAllRecords(),
      ])
      if (!cancelled) {
        setMistakeQuestions(mistakes.map((q) => q.id))
        setTotalQuestions(all.map((q) => q.id))
        setAllQuestions(all)

        const recs = recommendWeakPointQuestions(records, all, 5)
        setWeakQuestions(recs)

        if (recs.length > 0 && records.length > 0) {
          const weakDim = getWeakDimension(records)
          if (weakDim) {
            setWeakLabel(weakDim.dimension)
          } else {
            const weakFw = getWeakFramework(records)
            if (weakFw) {
              setWeakLabel(weakFw.framework)
            }
          }
        }

        setLoading(false)
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  const handleMistakePractice = useCallback(() => {
    if (mistakeQuestions.length === 0) return
    const id =
      mistakeQuestions[Math.floor(Math.random() * mistakeQuestions.length)]
    onStartPractice(id)
  }, [mistakeQuestions, onStartPractice])

  const handleWeakPractice = useCallback(() => {
    if (weakQuestions.length === 0) return
    const id = weakQuestions[Math.floor(Math.random() * weakQuestions.length)].id
    onStartPractice(id)
  }, [weakQuestions, onStartPractice])

  const handleRandomPractice = useCallback(() => {
    if (totalQuestions.length === 0) return
    const id =
      totalQuestions[Math.floor(Math.random() * totalQuestions.length)]
    onStartPractice(id)
  }, [totalQuestions, onStartPractice])

  const handleFrameworkPractice = useCallback((frameworkName: string) => {
    const matches = allQuestions.filter((q) => q.framework === frameworkName)
    if (matches.length === 0) {
      toast.info(t('today.noQuestionsForFramework', { framework: frameworkName }))
      return
    }
    const id = matches[Math.floor(Math.random() * matches.length)].id
    onStartPractice(id)
  }, [allQuestions, onStartPractice, t])

  const handleSketchPractice = useCallback(async (frameworkName: string) => {
    const question = generateSketchQuestion(frameworkName)
    await db.addQuestion(question)
    onStartPractice(question.id)
  }, [onStartPractice])

  const handleBlindPractice = useCallback(() => {
    if (allQuestions.length === 0) return
    const id = allQuestions[Math.floor(Math.random() * allQuestions.length)].id
    onStartPractice(id, 'blind')
  }, [allQuestions, onStartPractice])

  const mistakeCount = mistakeQuestions.length
  const totalCount = totalQuestions.length
  const weakCount = weakQuestions.length
  const hasWeakData = weakCount > 0

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-display text-[26px] font-bold leading-[1.05] tracking-[-0.022em] md:text-[32px]">
          {t('today.title')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('today.subtitle')}
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : totalCount === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          {t('today.emptyBank')}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-card shadow-elevation-2 h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg font-semibold">
                <Flame className="size-5 text-primary" strokeWidth={1.5} />
                {t('today.mistakeReview.title')}
              </CardTitle>
              <CardDescription>
                {t('today.mistakeReview.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t('today.mistakeReview.label')}
                  </span>
                  <Badge variant="secondary" className="tabular-nums">
                    {mistakeCount}
                  </Badge>
                </div>
              </div>
              <Button
                className="w-full"
                disabled={mistakeCount === 0}
                onClick={handleMistakePractice}
              >
                {t('today.mistakeReview.button')}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-elevation-2 h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg font-semibold">
                <Target className="size-5 text-primary" strokeWidth={1.5} />
                {t('today.weakPoint.title')}
              </CardTitle>
              <CardDescription>
                {t('today.weakPoint.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t('today.weakPoint.label')}</span>
                  <Badge variant="secondary" className="tabular-nums">
                    {weakCount}
                  </Badge>
                </div>
                {hasWeakData ? (
                  <p className="text-xs text-muted-foreground">
                    {t('today.weakPoint.detected', { weakness: weakLabel })}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('today.weakPoint.empty')}
                  </p>
                )}
              </div>
              <Button className="w-full" onClick={handleWeakPractice} disabled={!hasWeakData}>
                {t('today.weakPoint.button')}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-elevation-2 h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg font-semibold">
                <Shuffle className="size-5 text-primary" strokeWidth={1.5} />
                {t('today.random.title')}
              </CardTitle>
              <CardDescription>
                {t('today.random.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t('today.random.label')}</span>
                  <Badge variant="secondary" className="tabular-nums">
                    {totalCount}
                  </Badge>
                </div>
              </div>
              <Button className="w-full" onClick={handleRandomPractice}>
                {t('today.random.button')}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-elevation-2 h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg font-semibold">
                <LayoutTemplate className="size-5 text-primary" strokeWidth={1.5} />
                {t('today.framework.title')}
              </CardTitle>
              <CardDescription>
                {t('today.framework.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {BUILTIN_FRAMEWORKS.map((fw) => {
                  const count = allQuestions.filter((q) => q.framework === fw.name).length
                  return (
                    <button
                      key={fw.id}
                      type="button"
                      disabled={count === 0}
                      onClick={() => handleFrameworkPractice(fw.name)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                      title={t(`framework.${fwTKey(fw.id)}.focus`)}
                    >
                      {t(`framework.${fwTKey(fw.id)}.name`)}
                      <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                        {count}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-elevation-2 h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg font-semibold">
                <Eye className="size-5 text-primary" strokeWidth={1.5} />
                {t('today.blind.title')}
              </CardTitle>
              <CardDescription>
                {t('today.blind.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t('today.blind.label')}</span>
                  <Badge variant="secondary" className="tabular-nums">
                    {totalCount}
                  </Badge>
                </div>
              </div>
              <Button className="w-full" onClick={handleBlindPractice}>
                {t('today.blind.button')}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-elevation-2 h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg font-semibold">
                <Zap className="size-5 text-primary" strokeWidth={1.5} />
                {t('today.sketch.title')}
              </CardTitle>
              <CardDescription>
                {t('today.sketch.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {BUILTIN_FRAMEWORKS.map((fw) => (
                  <button
                    key={fw.id}
                    type="button"
                    onClick={() => handleSketchPractice(fw.name)}
                    className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-muted"
                    title={t(`framework.${fwTKey(fw.id)}.focus`)}
                  >
                    {t(`framework.${fwTKey(fw.id)}.name`)}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
