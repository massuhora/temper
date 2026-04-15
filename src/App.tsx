import { Suspense, lazy, useEffect, useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AppLayout } from "@/layouts/AppLayout"
import { TodayTraining } from "@/pages/TodayTraining"

import type { PracticeRecord } from "@/types"
import { toast } from "sonner"
import { db } from "@/db"
import { DEFAULT_QUESTIONS } from "@/lib/defaultQuestions"
import { useTranslation } from "react-i18next"

type Page = "today" | "bank" | "practice" | "stats" | "data" | "knowledge"

const QuestionBank = lazy(() =>
  import("@/pages/QuestionBank").then((module) => ({
    default: module.QuestionBank,
  }))
)
const PracticeSession = lazy(() =>
  import("@/pages/PracticeSession").then((module) => ({
    default: module.PracticeSession,
  }))
)
const Statistics = lazy(() =>
  import("@/pages/Statistics").then((module) => ({
    default: module.Statistics,
  }))
)
const DataManagement = lazy(() =>
  import("@/pages/DataManagement").then((module) => ({
    default: module.DataManagement,
  }))
)
const KnowledgeBase = lazy(() =>
  import("@/pages/KnowledgeBase").then((module) => ({
    default: module.KnowledgeBase,
  }))
)

function App() {
  const { t } = useTranslation()
  const [page, setPage] = useState<Page>("today")
  const [practiceQuestionId, setPracticeQuestionId] = useState<string | null>(null)
  const [practiceMode, setPracticeMode] = useState<'normal' | 'blind'>('normal')

  useEffect(() => {
    let cancelled = false
    const initDefaultQuestions = async () => {
      try {
        const all = await db.getAllQuestions()
        if (cancelled) return
        if (all.length === 0) {
          for (const q of DEFAULT_QUESTIONS) {
            await db.addQuestion(q)
          }
          toast.success(t('app.defaultQuestionsLoaded'))
        }
      } catch {
        // ignore initialization errors
      }
    }
    initDefaultQuestions()
    return () => {
      cancelled = true
    }
  }, [t])

  const handleStartPractice = (questionId: string, mode: 'normal' | 'blind' = 'normal') => {
    setPracticeQuestionId(questionId)
    setPracticeMode(mode)
    setPage("practice")
  }

  const handleBackFromPractice = () => {
    setPracticeQuestionId(null)
    setPracticeMode('normal')
    setPage("today")
  }

  const handlePracticeFinish = async (record: PracticeRecord) => {
    toast.success(t('app.practiceComplete', { score: record.overallScore?.toFixed(1) ?? "-" }))
    setPracticeQuestionId(null)
    setPage("today")
  }

  const renderLoading = () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {t('common.loading')}
    </div>
  )

  const renderPage = () => {
    switch (page) {
      case "today":
        return <TodayTraining onStartPractice={handleStartPractice} />
      case "bank":
        return (
          <Suspense fallback={renderLoading()}>
            <QuestionBank onStartPractice={handleStartPractice} />
          </Suspense>
        )
      case "practice":
        if (!practiceQuestionId) {
          return (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {t('app.noQuestionSelected')}
            </div>
          )
        }
        return (
          <Suspense fallback={renderLoading()}>
            <PracticeSession
              questionId={practiceQuestionId}
              mode={practiceMode}
              onBack={handleBackFromPractice}
              onFinish={handlePracticeFinish}
            />
          </Suspense>
        )
      case "stats":
        return (
          <Suspense fallback={renderLoading()}>
            <Statistics />
          </Suspense>
        )
      case "data":
        return (
          <Suspense fallback={renderLoading()}>
            <DataManagement />
          </Suspense>
        )
      case "knowledge":
        return (
          <Suspense fallback={renderLoading()}>
            <KnowledgeBase />
          </Suspense>
        )
      default:
        return null
    }
  }

  return (
    <TooltipProvider>
      <AppLayout page={page} onChangePage={setPage}>
        {renderPage()}
      </AppLayout>
      <Toaster position="top-center" richColors />
    </TooltipProvider>
  )
}

export default App
