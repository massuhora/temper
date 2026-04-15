import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronDown, ChevronUp, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { useAIStream } from "@/hooks/useAIStream";
import { buildIteratePrompt, buildSystemPromptForType, buildUserPrompt } from "@/services/aiPrompts";
import {
  parseDimensionScores,
  parseIssueList,
  parseOptimizedAnswer,
  parseOverallScore,
} from "@/lib/feedbackParser";
import { BUILTIN_FRAMEWORKS } from "@/lib/frameworks";
import type { Message, PracticeRecord, Question, Principle } from "@/types";

interface PracticeSessionProps {
  questionId: string;
  mode?: 'normal' | 'blind';
  onBack: () => void;
  onFinish: (record: PracticeRecord) => void;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface CategoryItem {
  name: string;
  items: string;
}

function serializeCategories(cats: CategoryItem[]): string {
  return cats
    .filter((c) => c.name.trim())
    .map((c) => {
      const items = c.items
        .split("\n")
        .map((i) => i.trim())
        .filter(Boolean)
        .map((i) => (i.startsWith("- ") || i.startsWith("* ") ? i : `- ${i}`))
        .join("\n");
      return `## ${c.name.trim()}\n${items}`;
    })
    .join("\n\n");
}

function parseCategoriesFromMarkdown(text: string): CategoryItem[] {
  const cats: CategoryItem[] = [];
  const lines = text.split("\n");
  let current: CategoryItem | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      if (current) cats.push(current);
      current = { name: trimmed.slice(3).trim(), items: "" };
    } else if (current && (trimmed.startsWith("- ") || trimmed.startsWith("* "))) {
      current.items += trimmed.slice(2).trim() + "\n";
    }
  }
  if (current) cats.push(current);

  return cats.length > 0
    ? cats.map((c) => ({ ...c, items: c.items.trim() }))
    : [{ name: "", items: "" }];
}

const fwTKey = (id: string) => id === 'logic-tree' ? 'logicTree' : id

export function PracticeSession({
  questionId,
  mode: practiceMode = 'normal',
  onBack,
  onFinish,
}: PracticeSessionProps) {
  const { t } = useTranslation()
  const [question, setQuestion] = useState<Question | null>(null);
  const [settings, setSettings] = useState<{
    deepseekApiKey?: string;
    deepseekApiUrl?: string;
    defaultModel?: string;
    practiceDurationSeconds?: number;
    strictSketchMode?: boolean;
  }>({});
  const [userAnswer, setUserAnswer] = useState("");
  const [outline, setOutline] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<"input" | "feedback">("input");
  const [sessionRecords, setSessionRecords] = useState<PracticeRecord[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [savedAttempt, setSavedAttempt] = useState(0);
  const [lastDuration, setLastDuration] = useState(0);
  const [categories, setCategories] = useState<CategoryItem[]>([
    { name: "", items: "" },
  ]);
  const [relatedPrinciples, setRelatedPrinciples] = useState<Principle[]>([])
  const [principleIndex, setPrincipleIndex] = useState(0)
  const [selectedFramework, setSelectedFramework] = useState("")
  const autoSubmittedRef = useRef(false)
  const isCountdown = question?.type === "限时结构速写";
  const durationLimit = settings.practiceDurationSeconds || 300;
  const remainingSeconds = Math.max(0, durationLimit - seconds);
  const displaySeconds = isCountdown ? remainingSeconds : seconds;
  const timeExpired = isCountdown && mode === "input" && seconds >= durationLimit;
  const strictSketchMode = settings.strictSketchMode ?? false;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [q, s, principles] = await Promise.all([
        db.getQuestionById(questionId),
        db.getSettings(),
        db.getAllPrinciples(),
      ]);
      if (!mounted) return;
      if (q) {
        setQuestion(q);
        if (q.framework) {
          const framework = q.framework
          const matched = principles.filter((p) => {
            const inTags = p.tags?.some((t) => t.includes(framework)) ?? false
            const inTitle = p.title.includes(framework)
            return inTags || inTitle
          })
          setRelatedPrinciples(matched)
          setPrincipleIndex(0)
        } else {
          setRelatedPrinciples([])
          setPrincipleIndex(0)
        }
        if (q.type === "分类重构题") {
          setCategories(parseCategoriesFromMarkdown(""));
          setUserAnswer("");
        }
      }
      if (s) {
        setSettings({
          deepseekApiKey: s.deepseekApiKey,
          deepseekApiUrl: s.deepseekApiUrl,
          defaultModel: s.defaultModel,
          practiceDurationSeconds: s.practiceDurationSeconds,
          strictSketchMode: s.strictSketchMode,
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [questionId]);

  useEffect(() => {
    if (mode !== "input") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [mode]);

  const pendingSaveRef = useRef<{
    attempt: number;
    lastDuration: number;
    userAnswer: string;
    outline: string;
    messages: Message[];
  } | null>(null);

  const { submit, content, isLoading, error, abort } = useAIStream({
    apiKey: settings.deepseekApiKey || "",
    apiUrl: settings.deepseekApiUrl,
    model: settings.defaultModel,
    onFinish: (fullContent) => {
      if (!question || !pendingSaveRef.current) return;
      const { attempt, lastDuration, userAnswer, outline, messages } = pendingSaveRef.current;

      const assistantMessage: Message = { role: "assistant", content: fullContent };
      const nextMessages = [...messages, assistantMessage];
      setMessages(nextMessages);

      const scores = parseDimensionScores(fullContent);
      const issues = parseIssueList(fullContent);
      const optimized = parseOptimizedAnswer(fullContent);
      const overall = parseOverallScore(scores);

      const recordFramework = practiceMode === 'blind'
        ? (selectedFramework || question.framework || "")
        : (question.framework || "");

      const record: PracticeRecord = {
        id: `${questionId}-${Date.now()}`,
        practicedAt: new Date().toISOString(),
        questionId,
        framework: recordFramework,
        attempt,
        durationSeconds: lastDuration,
        userAnswer,
        outline,
        aiFeedback: fullContent,
        dimensionScores: scores,
        issueList: issues,
        optimizedAnswer: optimized,
        messages: nextMessages,
        overallScore: overall,
        isTimeExpired: isCountdown && lastDuration >= durationLimit,
      };

      void db.addRecord(record);
      setSessionRecords((prev) => [...prev, record]);
      setSavedAttempt(attempt);
      pendingSaveRef.current = null;
    },
  });

  const handleSubmit = () => {
    if (!question) return;
    const isCategorization = question.type === "分类重构题";
    if (isCategorization ? !userAnswer.trim() : !(outline.trim() && userAnswer.trim())) return;

    setLastDuration(seconds);
    setMode("feedback");

    const options = {
      autoSubmitted: false,
      blindMode: practiceMode === 'blind',
      userSelectedFramework: selectedFramework || undefined,
    };
    let nextMessages: Message[];
    if (attempt === 1) {
      nextMessages = [
        buildSystemPromptForType(question.type || "", options),
        buildUserPrompt(question, userAnswer, question.type || undefined, outline || undefined, options),
      ];
    } else {
      nextMessages = buildIteratePrompt(messages, userAnswer, outline || undefined, options);
    }
    setMessages(nextMessages);
    pendingSaveRef.current = {
      attempt,
      lastDuration: seconds,
      userAnswer,
      outline,
      messages: nextMessages,
    };
    submit(nextMessages);
  };

  const handleAutoSubmit = () => {
    if (!question) return;

    setLastDuration(seconds);
    setMode("feedback");

    const options = {
      autoSubmitted: true,
      blindMode: practiceMode === 'blind',
      userSelectedFramework: selectedFramework || undefined,
    };
    let nextMessages: Message[];
    if (attempt === 1) {
      nextMessages = [
        buildSystemPromptForType(question.type || "", options),
        buildUserPrompt(question, userAnswer, question.type || undefined, outline || undefined, options),
      ];
    } else {
      nextMessages = buildIteratePrompt(messages, userAnswer, outline || undefined, options);
    }
    setMessages(nextMessages);
    pendingSaveRef.current = {
      attempt,
      lastDuration: seconds,
      userAnswer,
      outline,
      messages: nextMessages,
    };
    submit(nextMessages);
  };

  const handleAutoSubmitRef = useRef(handleAutoSubmit);
  useEffect(() => {
    handleAutoSubmitRef.current = handleAutoSubmit;
  });

  useEffect(() => {
    if (timeExpired && strictSketchMode && mode === "input" && !isLoading && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      const id = setTimeout(() => handleAutoSubmitRef.current(), 0);
      return () => clearTimeout(id);
    }
  }, [timeExpired, strictSketchMode, mode, isLoading]);

  const handleContinue = () => {
    setAttempt((a) => a + 1);
    setSeconds(0);
    setMode("input");
    autoSubmittedRef.current = false;
    if (question?.type === "分类重构题") {
      setCategories(parseCategoriesFromMarkdown(userAnswer));
    }
  };

  const handleReset = () => {
    setUserAnswer("");
    setOutline("");
    setSeconds(0);
    setAttempt(1);
    setMessages([]);
    setMode("input");
    setSessionRecords([]);
    setSavedAttempt(0);
    setLastDuration(0);
    setCategories([{ name: "", items: "" }]);
    setSelectedFramework("");
    autoSubmittedRef.current = false;
    abort();
  };

  const hasApiKey = Boolean(settings.deepseekApiKey);
  const dimensionScores = parseDimensionScores(content);
  const issueList = parseIssueList(content);
  const optimizedAnswer = parseOptimizedAnswer(content);
  const overallScore = parseOverallScore(dimensionScores);
  const isParsingIncomplete =
    !isLoading &&
    !!content &&
    (Object.keys(dimensionScores).length === 0 || issueList.length === 0 || !optimizedAnswer);

  const currentRecord = sessionRecords.find((r) => r.attempt === attempt);
  const previousRecord = sessionRecords.find((r) => r.attempt === attempt - 1);
  const currentScore = currentRecord?.overallScore ?? overallScore;
  const previousScore = previousRecord?.overallScore;
  const delta =
    previousScore != null && currentScore != null ? currentScore - previousScore : null;

  const isCategorization = question?.type === "分类重构题";
  const inputDisabled = isLoading || timeExpired || (practiceMode === 'blind' && !selectedFramework);
  const canSubmit = (() => {
    const hasFramework = practiceMode !== 'blind' || !!selectedFramework;
    if (isCategorization) {
      return !!userAnswer.trim() && !isLoading && hasApiKey && hasFramework;
    }
    return !!outline.trim() && !!userAnswer.trim() && !isLoading && hasApiKey && hasFramework;
  })();

  const typeInstruction = (() => {
    switch (question?.type) {
      case "诊断改错题":
        return t('practice.typeInstruction.diagnostic')
      case "分类重构题":
        return t('practice.typeInstruction.categorization')
      case "限时结构速写":
        return t('practice.typeInstruction.sketch')
      case "自定义真题":
        return t('practice.typeInstruction.custom')
      default:
        return t('practice.typeInstruction.default')
    }
  })()

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="active:scale-95"
            aria-label={t('practice.back')}
          >
            <ArrowLeft className="size-4" />
          </Button>
          {question ? (
            <>
              <Badge variant="secondary" className="font-body text-xs uppercase tracking-wide">
                {practiceMode === 'blind' ? t('practice.blindBadge') : question.framework}
              </Badge>
              {question.type ? (
                <Badge variant="outline" className="font-body text-xs">
                  {question.type}
                </Badge>
              ) : null}
            </>
          ) : (
            <Badge variant="secondary" className="font-body text-xs uppercase tracking-wide">
              {t('practice.loadingBadge')}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 font-body text-sm tabular-nums text-foreground">
          <Clock className="size-4 text-muted-foreground" />
          <span>{formatTime(displaySeconds)}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 md:flex-row md:p-6">
        {/* Left: Question */}
        <Card className="flex-1 rounded-lg border border-border bg-card shadow-elevation-2">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-xl font-semibold tracking-tight text-card-foreground">
              {t('practice.questionTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {question ? (
              <div className="whitespace-pre-wrap font-body text-base leading-relaxed text-card-foreground">
                {question.content}
              </div>
            ) : (
              <div className="text-muted-foreground">{t('practice.loading')}</div>
            )}
          </CardContent>
        </Card>

        {/* Right: Answer + Feedback */}
        <div className="flex flex-1 flex-col gap-4">
          <Card className="flex flex-1 flex-col rounded-lg border border-border bg-card shadow-elevation-2">
            <CardHeader className="pb-4">
              <CardTitle className="font-display text-xl font-semibold tracking-tight text-card-foreground">
                {t('practice.answerArea')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              {mode === "input" && question && (
                <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
                  {typeInstruction}
                </div>
              )}
              {mode === "input" && relatedPrinciples.length > 0 && (
                <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{t('practice.principleReminder')}</span>
                    {relatedPrinciples.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPrincipleIndex((i) => (i - 1 + relatedPrinciples.length) % relatedPrinciples.length)}
                          className="rounded px-1 hover:bg-primary/20"
                        >
                          &lt;
                        </button>
                        <span className="text-xs tabular-nums">
                          {principleIndex + 1}/{relatedPrinciples.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPrincipleIndex((i) => (i + 1) % relatedPrinciples.length)}
                          className="rounded px-1 hover:bg-primary/20"
                        >
                          &gt;
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="font-medium">{relatedPrinciples[principleIndex].title}</div>
                  <div className="mt-1 text-primary/90">{relatedPrinciples[principleIndex].content}</div>
                </div>
              )}
              {mode === "input" && practiceMode === 'blind' && (
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">{t('practice.blindSelector.label')}</Label>
                  <select
                    value={selectedFramework}
                    onChange={(e) => setSelectedFramework(e.target.value)}
                    disabled={isLoading || timeExpired}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50"
                  >
                    <option value="">{t('practice.blindSelector.placeholder')}</option>
                    {BUILTIN_FRAMEWORKS.map((f) => (
                      <option key={f.id} value={f.name}>
                        {t(`framework.${fwTKey(f.id)}.name`)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {t('practice.blindSelector.helper')}
                  </p>
                </div>
              )}
              {mode === "input" && isCategorization ? (
                <CategorizationInput
                  categories={categories}
                  onChange={(next) => {
                    setCategories(next);
                    setUserAnswer(serializeCategories(next));
                  }}
                  disabled={inputDisabled}
                />
              ) : (
                <>
                  {mode === "input" && !isCategorization && (
                    <>
                      <Textarea
                        value={outline}
                        onChange={(e) => setOutline(e.target.value)}
                        disabled={inputDisabled}
                        placeholder={t('practice.outlinePlaceholder')}
                        className="min-h-[120px] resize-none rounded-md border-input bg-background font-body text-base leading-relaxed"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('practice.outlineHelper')}
                      </p>
                    </>
                  )}
                  <Textarea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    disabled={mode === "feedback" || inputDisabled}
                    placeholder={
                      mode === "input" && !isCategorization
                        ? t('practice.bodyPlaceholder')
                        : t('practice.generalPlaceholder')
                    }
                    className="min-h-[200px] flex-1 resize-none rounded-md border-input bg-background font-body text-base leading-relaxed"
                  />
                </>
              )}

              {mode === "input" && (
                <>
                  {timeExpired && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                      {strictSketchMode ? t('practice.timeExpiredAutoSubmit') : t('practice.timeExpiredPleaseSubmit')}
                    </div>
                  )}
                  {!hasApiKey && !isLoading && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                      {t('practice.missingApiKey')}
                      <Button
                        variant="link"
                        className="h-auto px-1 py-0 font-body text-sm"
                        onClick={onBack}
                      >
                        {t('practice.dataManagementLink')}
                      </Button>
                      {t('practice.missingApiKeySuffix')}
                    </div>
                  )}
                  {error && !isLoading && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                      {error.message}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      className="active:scale-95"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          {t('practice.thinking')}
                        </>
                      ) : (
                        t('practice.submitAnswer')
                      )}
                    </Button>
                  </div>
                </>
              )}

              {mode === "feedback" && (
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={onBack} className="active:scale-95">
                    {t('practice.return')}
                  </Button>
                  <Button variant="outline" onClick={handleReset} className="active:scale-95">
                    {t('practice.practiceAgain')}
                  </Button>
                  <Button
                    onClick={handleContinue}
                    disabled={isLoading}
                    variant="outline"
                    className="active:scale-95"
                  >
                    {t('practice.continueEdit')}
                  </Button>
                  <Button
                    onClick={() => {
                      const record = sessionRecords[sessionRecords.length - 1];
                      if (record) onFinish(record);
                    }}
                    disabled={isLoading || savedAttempt !== attempt}
                    className="active:scale-95"
                  >
                    {t('practice.complete')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feedback panel */}
          {mode === "feedback" && (
            <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
              <CardHeader className="pb-4">
                <CardTitle className="font-display text-lg font-semibold tracking-tight text-card-foreground">
                  {t('practice.feedbackTitle', { attempt })}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {isLoading && !content ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="font-body text-sm">{t('practice.waitingModel')}</span>
                  </div>
                ) : error && !content ? (
                  <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {error.message}
                  </div>
                ) : (
                  <>
                    {isParsingIncomplete && (
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700">
                        {t('practice.parseWarning')}
                      </div>
                    )}

                    {/* Round summary */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{t('practice.totalScore', { score: currentScore })}</Badge>
                      <Badge variant="outline">{t('practice.timeUsed', { time: formatTime(lastDuration) })}</Badge>
                      <Badge variant="outline">{t('practice.roundBadge', { attempt })}</Badge>
                      {previousScore != null && (
                        <Badge variant="outline">{t('practice.previousScore', { score: previousScore })}</Badge>
                      )}
                      {delta != null && (
                        <Badge variant={delta >= 0 ? "default" : "destructive"}
                        >
                          {delta >= 0 ? t('practice.deltaPositive', { delta: delta.toFixed(1) }) : t('practice.deltaNegative', { delta: delta.toFixed(1) })}
                        </Badge>
                      )}
                    </div>

                    {/* Outline display */}
                    {currentRecord?.outline && (
                      <details className="rounded-md border border-border bg-muted/30">
                        <summary className="cursor-pointer p-3 font-body text-sm font-medium text-muted-foreground hover:text-foreground">
                          {t('practice.outlineSummary')}
                        </summary>
                        <div className="border-t border-border px-3 py-2">
                          <div className="max-h-40 overflow-auto whitespace-pre-wrap font-body text-sm leading-relaxed text-card-foreground">
                            {currentRecord.outline}
                          </div>
                        </div>
                      </details>
                    )}

                    {/* Dimension scores */}
                    {Object.keys(dimensionScores).length > 0 && (
                      <div>
                        <h4 className="mb-2 font-display text-sm font-semibold text-foreground">
                          {t('practice.dimensionScores')}
                        </h4>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {Object.entries(dimensionScores).map(([dim, score]) => (
                            <div
                              key={dim}
                              className="rounded-md border border-border bg-muted/50 p-2 text-center"
                            >
                              <div className="text-xs text-muted-foreground">{dim}</div>
                              <div className="font-body text-lg font-semibold text-foreground">
                                {score}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Related principles */}
                    {issueList.length > 0 && (
                      <div>
                        <h4 className="mb-2 font-display text-sm font-semibold text-foreground">
                          {t('practice.recommendedPrinciples')}
                        </h4>
                        {relatedPrinciples.length > 0 ? (
                          <div className="space-y-2">
                            {relatedPrinciples.map((p) => (
                              <div
                                key={p.id}
                                className="rounded-md border border-border bg-muted/30 p-2"
                              >
                                <div className="text-sm font-medium text-card-foreground">{p.title}</div>
                                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                  {p.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                            {t('practice.noPrinciples')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Issue list */}
                    {issueList.length > 0 && (
                      <div>
                        <h4 className="mb-2 font-display text-sm font-semibold text-foreground">
                          {t('practice.issueList')}
                        </h4>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-card-foreground">
                          {issueList.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Optimized answer */}
                    {optimizedAnswer && (
                      <div>
                        <h4 className="mb-2 font-display text-sm font-semibold text-foreground">
                          {t('practice.optimizedVersion')}
                        </h4>
                        <div className="max-h-60 overflow-auto rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap font-body text-sm leading-relaxed text-card-foreground">
                          {optimizedAnswer}
                        </div>
                      </div>
                    )}

                    {/* Raw feedback */}
                    <div className="border-t border-border pt-4">
                      <details>
                        <summary className="cursor-pointer font-body text-sm font-medium text-muted-foreground hover:text-foreground">
                          {t('practice.rawFeedback')}
                        </summary>
                        <div className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-3 font-body text-sm leading-relaxed text-card-foreground">
                          {content}
                          {isLoading && (
                            <span className="inline-block w-2 animate-pulse">▍</span>
                          )}
                        </div>
                      </details>
                    </div>

                    {/* Session history */}
                    {sessionRecords.length > 0 && (
                      <div className="border-t border-border pt-4">
                        <button
                          type="button"
                          onClick={() => setHistoryExpanded((e) => !e)}
                          className="flex w-full items-center justify-between font-display text-sm font-semibold text-foreground"
                        >
                          <span>{t('practice.historySummary')}</span>
                          {historyExpanded ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </button>
                        {historyExpanded && (
                          <div className="mt-2 space-y-2">
                            {sessionRecords.map((r) => (
                              <div
                                key={r.id}
                                className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-2 text-sm"
                              >
                                <span>{t('practice.historyRound', { round: r.attempt || 1 })}</span>
                                <span className="text-muted-foreground">
                                  {t('practice.historyTime', { time: formatTime(r.durationSeconds || 0) })}
                                </span>
                                <span className="font-medium">{t('practice.historyScore', { score: r.overallScore ?? '-' })}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}


function CategorizationInput({
  categories,
  onChange,
  disabled,
}: {
  categories: CategoryItem[];
  onChange: (cats: CategoryItem[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation()
  const updateName = (idx: number, name: string) => {
    const next = [...categories];
    next[idx] = { ...next[idx], name };
    onChange(next);
  };
  const updateItems = (idx: number, items: string) => {
    const next = [...categories];
    next[idx] = { ...next[idx], items };
    onChange(next);
  };
  const addCategory = () => {
    onChange([...categories, { name: "", items: "" }]);
  };
  const removeCategory = (idx: number) => {
    const next = categories.filter((_, i) => i !== idx);
    onChange(next.length > 0 ? next : [{ name: "", items: "" }]);
  };

  return (
    <div className="flex flex-col gap-3">
      {categories.map((cat, idx) => (
        <div key={idx} className="rounded-md border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-2">
            <input
              type="text"
              value={cat.name}
              onChange={(e) => updateName(idx, e.target.value)}
              disabled={disabled}
              placeholder={t('practice.categorization.categoryPlaceholder', { idx: idx + 1 })}
              className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => removeCategory(idx)}
              className="h-7 px-2 text-destructive hover:text-destructive"
            >
              {t('practice.categorization.delete')}
            </Button>
          </div>
          <textarea
            value={cat.items}
            onChange={(e) => updateItems(idx, e.target.value)}
            disabled={disabled}
            placeholder={t('practice.categorization.itemPlaceholder')}
            rows={3}
            className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50"
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={addCategory}
        className="w-fit"
      >
        {t('practice.categorization.addCategory')}
      </Button>
    </div>
  );
}
