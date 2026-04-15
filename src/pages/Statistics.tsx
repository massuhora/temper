import { useEffect, useMemo, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
} from "recharts";
import { Eye, BookOpen, Plus, Pencil, Trash2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";

import { db } from "@/db";
import type { PracticeRecord, Question, Principle, Message } from "@/types";
import {
  calcActiveDays,
  calcWeeklyTrend,
  calcMonthlyTrend,
  calcFrameworkAverages,
  calcTopIssues,
} from "@/lib/statistics";
import { BUILTIN_FRAMEWORKS } from "@/lib/frameworks";

function collectDimensionNames(records: PracticeRecord[]): string[] {
  const set = new Set<string>();
  for (const r of records) {
    if (r.dimensionScores) {
      for (const k of Object.keys(r.dimensionScores)) {
        set.add(k);
      }
    }
  }
  return Array.from(set);
}

function frameworkKey(id: string) {
  return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export function Statistics() {
  const { t, i18n } = useTranslation();
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [mistakeQuestions, setMistakeQuestions] = useState<Question[]>([]);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<PracticeRecord | null>(
    null
  );
  const [detailQuestion, setDetailQuestion] = useState<Question | undefined>();
  const [showDetail, setShowDetail] = useState(false);
  const [showPrincipleDialog, setShowPrincipleDialog] = useState(false);
  const [editingPrinciple, setEditingPrinciple] = useState<Principle | null>(
    null
  );
  const [principleForm, setPrincipleForm] = useState({
    title: "",
    content: "",
    tags: "",
  });
  const [trendTab, setTrendTab] = useState<"week" | "month">("week");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [r, q, m, p] = await Promise.all([
        db.getAllRecords(),
        db.getAllQuestions(),
        db.getMistakeQuestions(),
        db.getAllPrinciples(),
      ]);
      if (!mounted) return;
      setRecords(r);
      setQuestions(q);
      setMistakeQuestions(m);
      setPrinciples(p);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = records.length;
    const avg =
      total > 0
        ? records.reduce((sum, r) => sum + (r.overallScore ?? 0), 0) / total
        : 0;
    return {
      total,
      avg: Math.round(avg * 10) / 10,
      mistakeCount: mistakeQuestions.length,
      activeDays: calcActiveDays(records),
    };
  }, [records, mistakeQuestions]);

  const dimensionNames = useMemo(
    () => collectDimensionNames(records),
    [records]
  );

  const radarData = useMemo(() => {
    const sums: Record<string, { sum: number; count: number }> = {};
    for (const name of dimensionNames) {
      sums[name] = { sum: 0, count: 0 };
    }
    for (const record of records) {
      const scores = record.dimensionScores || {};
      for (const [dim, score] of Object.entries(scores)) {
        if (sums[dim]) {
          sums[dim].sum += score;
          sums[dim].count += 1;
        }
      }
    }
    return dimensionNames.map((name) => ({
      dimension: name,
      score:
        sums[name].count > 0
          ? Math.round((sums[name].sum / sums[name].count) * 10) / 10
          : 0,
      fullMark: 10,
    }));
  }, [records, dimensionNames]);

  const weeklyTrend = useMemo(() => calcWeeklyTrend(records), [records]);
  const monthlyTrend = useMemo(() => calcMonthlyTrend(records), [records]);
  const frameworkAverages = useMemo(
    () => calcFrameworkAverages(records),
    [records]
  );
  const topIssues = useMemo(() => calcTopIssues(records, 5), [records]);

  const recentRecords = useMemo(() => {
    return [...records]
      .sort(
        (a, b) =>
          new Date(b.practicedAt).getTime() - new Date(a.practicedAt).getTime()
      )
      .slice(0, 10);
  }, [records]);

  const handleViewRecord = async (record: PracticeRecord) => {
    setSelectedRecord(record);
    const q = await db.getQuestionById(record.questionId);
    setDetailQuestion(q);
    setShowDetail(true);
  };

  const handleOpenPrincipleForm = (p?: Principle) => {
    if (p) {
      setEditingPrinciple(p);
      setPrincipleForm({
        title: p.title,
        content: p.content,
        tags: p.tags?.join(", ") || "",
      });
    } else {
      setEditingPrinciple(null);
      setPrincipleForm({ title: "", content: "", tags: "" });
    }
    setShowPrincipleDialog(true);
  };

  const handleSavePrinciple = async () => {
    const tags = principleForm.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (editingPrinciple) {
      await db.updatePrinciple(editingPrinciple.id, {
        title: principleForm.title,
        content: principleForm.content,
        tags,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await db.addPrinciple({
        id: crypto.randomUUID(),
        title: principleForm.title,
        content: principleForm.content,
        tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    setShowPrincipleDialog(false);
    setPrinciples(await db.getAllPrinciples());
  };

  const handleDeletePrinciple = async (id: string) => {
    await db.deletePrinciple(id);
    setPrinciples(await db.getAllPrinciples());
  };

  const empty = records.length === 0;
  const dateLocale = i18n.language === "zh" ? "zh-CN" : "en-US";

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {t("stats.title")}
        </h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">
          {t("stats.subtitle")}
        </p>
      </div>

      {empty ? (
        <Card className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-16 shadow-elevation-2">
          <BookOpen className="size-10 text-muted-foreground" />
          <p className="font-body text-sm text-muted-foreground">
            {t("stats.empty")}
          </p>
        </Card>
      ) : (
        <>
          {/* Top stats row */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
              <CardContent className="flex flex-col gap-1 py-5">
                <span className="font-display text-3xl font-bold tabular-nums text-foreground">
                  {stats.total}
                </span>
                <span className="font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("stats.totalPractices")}
                </span>
              </CardContent>
            </Card>
            <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
              <CardContent className="flex flex-col gap-1 py-5">
                <span className="font-display text-3xl font-bold tabular-nums text-foreground">
                  {stats.avg.toFixed(1)}
                </span>
                <span className="font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("stats.averageScore")}
                </span>
              </CardContent>
            </Card>
            <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
              <CardContent className="flex flex-col gap-1 py-5">
                <span className="font-display text-3xl font-bold tabular-nums text-foreground">
                  {stats.mistakeCount}
                </span>
                <span className="font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("stats.mistakeCount")}
                </span>
              </CardContent>
            </Card>
            <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
              <CardContent className="flex flex-col gap-1 py-5">
                <span className="font-display text-3xl font-bold tabular-nums text-foreground">
                  {stats.activeDays}
                </span>
                <span className="font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("stats.activeDays")}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Charts row */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg font-semibold tracking-tight text-card-foreground">
                  {t("stats.radarTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-[300px]">
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                    data={radarData}
                  >
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis
                      dataKey="dimension"
                      tick={{
                        fill: "var(--muted-foreground)",
                        fontSize: 12,
                        fontFamily: "JetBrains Mono",
                      }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 10]}
                      tick={{
                        fill: "var(--muted-foreground)",
                        fontSize: 10,
                        fontFamily: "JetBrains Mono",
                      }}
                    />
                    <Radar
                      name={t("stats.averageScore")}
                      dataKey="score"
                      stroke="var(--chart-1)"
                      fill="var(--chart-1)"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg font-semibold tracking-tight text-card-foreground">
                  {t("stats.trendTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-[300px]">
                <Tabs
                  value={trendTab}
                  onValueChange={(v) => setTrendTab(v as "week" | "month")}
                  className="w-full"
                >
                  <TabsList className="mb-4">
                    <TabsTrigger value="week">
                      {t("stats.weeklyTrend")}
                    </TabsTrigger>
                    <TabsTrigger value="month">
                      {t("stats.monthlyTrend")}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="week">
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={weeklyTrend}>
                        <CartesianGrid
                          stroke="var(--border)"
                          strokeDasharray="3 3"
                        />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <ReTooltip />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="var(--chart-1)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </TabsContent>
                  <TabsContent value="month">
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={monthlyTrend}>
                        <CartesianGrid
                          stroke="var(--border)"
                          strokeDasharray="3 3"
                        />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <ReTooltip />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="var(--chart-1)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Framework averages + top issues */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg font-semibold tracking-tight text-card-foreground">
                  {t("stats.frameworkAvgTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-[220px]">
                <div className="mb-4 flex flex-wrap gap-2">
                  {BUILTIN_FRAMEWORKS.map((fw) => (
                    <Badge
                      key={fw.id}
                      variant="outline"
                      className="text-xs"
                      title={t(`framework.${frameworkKey(fw.id)}.focus`)}
                    >
                      {t(`framework.${frameworkKey(fw.id)}.name`)}
                    </Badge>
                  ))}
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  {t("stats.builtinFramework")}
                  {BUILTIN_FRAMEWORKS.map(
                    (f) =>
                      `${t(`framework.${frameworkKey(f.id)}.name`)}（${t(
                        `framework.${frameworkKey(f.id)}.focus`
                      )}）`
                  ).join(", ")}
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={frameworkAverages}>
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                    />
                    <XAxis dataKey="framework" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <ReTooltip />
                    <Bar
                      dataKey="avg"
                      fill="var(--chart-2)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg font-semibold tracking-tight text-card-foreground">
                  {t("stats.topIssuesTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topIssues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("stats.noIssues")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {topIssues.map((item, idx) => (
                      <div key={item.issue} className="flex items-center gap-3">
                        <span className="w-6 text-sm font-medium text-muted-foreground">
                          {t("stats.rank", { rank: idx + 1 })}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">
                              {item.issue}
                            </span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {t("stats.issueCount", { count: item.count })}
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (item.count / (topIssues[0]?.count || 1)) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent records + Principle library tabs */}
          <Tabs defaultValue="records" className="w-full">
            <TabsList>
              <TabsTrigger value="records">
                {t("stats.recentRecords.tab")}
              </TabsTrigger>
              <TabsTrigger value="principles">
                {t("stats.principles.tab")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="records">
              <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-lg font-semibold tracking-tight text-card-foreground">
                    {t("stats.recentRecords.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t("stats.recentRecords.time")}
                          </th>
                          <th className="px-3 py-2 text-left font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t("stats.recentRecords.framework")}
                          </th>
                          <th className="px-3 py-2 text-left font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t("stats.recentRecords.score")}
                          </th>
                          <th className="px-3 py-2 text-right font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t("stats.recentRecords.action")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {recentRecords.map((record) => {
                          const q = questions.find(
                            (x) => x.id === record.questionId
                          );
                          return (
                            <tr key={record.id} className="bg-card">
                              <td className="px-3 py-2 font-body text-sm tabular-nums text-card-foreground">
                                {new Date(record.practicedAt).toLocaleString(
                                  dateLocale,
                                  {
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </td>
                              <td className="px-3 py-2 font-body text-sm text-card-foreground">
                                {record.framework || q?.framework || "—"}
                              </td>
                              <td className="px-3 py-2 font-body text-sm tabular-nums text-card-foreground">
                                {record.overallScore?.toFixed(1) ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1 px-2 active:scale-95"
                                  onClick={() => handleViewRecord(record)}
                                >
                                  <Eye className="size-4" />
                                  {t("stats.recentRecords.view")}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="principles">
              <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="font-display text-lg font-semibold tracking-tight text-card-foreground">
                    {t("stats.principles.title")}
                  </CardTitle>
                  <Button size="sm" onClick={() => handleOpenPrincipleForm()}>
                    <Plus className="mr-1 size-4" />
                    {t("stats.principles.add")}
                  </Button>
                </CardHeader>
                <CardContent>
                  {principles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                      <Target className="size-8 text-muted-foreground" />
                      <p>{t("stats.principles.empty")}</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {principles.map((p) => (
                        <Card
                          key={p.id}
                          className="border border-border bg-muted/30"
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-display text-base font-semibold">
                                {p.title}
                              </h3>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => handleOpenPrincipleForm(p)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-destructive"
                                  onClick={() => handleDeletePrinciple(p.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                              {p.content}
                            </p>
                            {p.tags && p.tags.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1">
                                {p.tags.map((t) => (
                                  <Badge
                                    key={t}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Record detail dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{t("stats.recordDetail.title")}</DialogTitle>
            <DialogDescription>
              {detailQuestion?.title ||
                detailQuestion?.prompt ||
                t("stats.recordDetail.unknownQuestion")}
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4 rounded-lg border border-border p-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("stats.recordDetail.round")}
                  </p>
                  <p className="text-sm font-medium">
                    {selectedRecord.attempt ?? 1}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("stats.recordDetail.duration")}
                  </p>
                  <p className="text-sm font-medium">
                    {selectedRecord.durationSeconds
                      ? t("stats.recordDetail.durationValue", {
                          minutes: Math.floor(
                            selectedRecord.durationSeconds / 60
                          ),
                          seconds: selectedRecord.durationSeconds % 60,
                        })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("stats.recordDetail.totalScore")}
                  </p>
                  <p className="text-sm font-medium">
                    {selectedRecord.overallScore?.toFixed(1) ?? "—"}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">
                  {t("stats.recordDetail.dimensionScores")}
                </p>
                <div className="rounded-md border border-border">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          {t("stats.recordDetail.dimension")}
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          {t("common.score")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {Object.entries(selectedRecord.dimensionScores || {}).map(
                        ([dim, score]) => (
                          <tr key={dim}>
                            <td className="px-3 py-2 text-sm">{dim}</td>
                            <td className="px-3 py-2 text-sm tabular-nums">
                              {score}
                            </td>
                          </tr>
                        )
                      )}
                      {Object.keys(selectedRecord.dimensionScores || {})
                        .length === 0 && (
                        <tr>
                          <td
                            className="px-3 py-2 text-sm text-muted-foreground"
                            colSpan={2}
                          >
                            {t("stats.recordDetail.noDimensionScores")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">
                  {t("stats.recordDetail.issues")}
                </p>
                {selectedRecord.issueList &&
                selectedRecord.issueList.length > 0 ? (
                  <ul className="list-disc space-y-1 rounded-lg border border-border p-4 pl-5">
                    {selectedRecord.issueList.map((issue, i) => (
                      <li key={i} className="text-sm text-foreground">
                        {issue}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("stats.recordDetail.noIssues")}
                  </p>
                )}
              </div>

              <CollapsibleSection
                title={t("stats.recordDetail.chatHistory")}
                content={selectedRecord.messages}
              />
              <CollapsibleSection
                title={t("stats.recordDetail.optimizedVersion")}
                content={
                  selectedRecord.optimizedAnswer ||
                  selectedRecord.aiOptimizedVersion ||
                  ""
                }
              />
              <CollapsibleSection
                title={t("stats.recordDetail.userAnswer")}
                content={selectedRecord.userAnswer || ""}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(false)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Principle form dialog */}
      <Dialog
        open={showPrincipleDialog}
        onOpenChange={setShowPrincipleDialog}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPrinciple
                ? t("stats.principleForm.editTitle")
                : t("stats.principleForm.newTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("stats.principleForm.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-title">
                {t("stats.principleForm.title")}
              </Label>
              <Input
                id="p-title"
                value={principleForm.title}
                onChange={(e) =>
                  setPrincipleForm((s) => ({ ...s, title: e.target.value }))
                }
                placeholder={t("stats.principleForm.titlePlaceholder")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-content">
                {t("stats.principleForm.content")}
              </Label>
              <Textarea
                id="p-content"
                value={principleForm.content}
                onChange={(e) =>
                  setPrincipleForm((s) => ({ ...s, content: e.target.value }))
                }
                placeholder={t("stats.principleForm.contentPlaceholder")}
                rows={6}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-tags">
                {t("stats.principleForm.tags")}
              </Label>
              <Input
                id="p-tags"
                value={principleForm.tags}
                onChange={(e) =>
                  setPrincipleForm((s) => ({ ...s, tags: e.target.value }))
                }
                placeholder={t("stats.principleForm.tagsPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPrincipleDialog(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSavePrinciple}
              disabled={
                !principleForm.title.trim() || !principleForm.content.trim()
              }
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CollapsibleSection({
  title,
  content,
}: {
  title: string;
  content: string | Message[] | undefined;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const hasMessages = Array.isArray(content);
  const isEmpty = hasMessages
    ? content.length === 0
    : !content || (typeof content === "string" && content.trim() === "");

  if (isEmpty) {
    return (
      <div>
        <p className="mb-2 text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{t("common.noContent")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
      >
        {title}
        <span className="text-xs text-muted-foreground">
          {open ? t("common.collapse") : t("common.expand")}
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3">
          {hasMessages ? (
            <div className="flex flex-col gap-3">
              {(content as Message[]).map((m, idx) => (
                <div
                  key={idx}
                  className={`rounded-md px-3 py-2 text-sm ${
                    m.role === "system"
                      ? "bg-muted text-muted-foreground"
                      : m.role === "user"
                        ? "bg-primary/10 text-foreground"
                        : "bg-secondary/50 text-foreground"
                  }`}
                >
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide opacity-80">
                    {t(`stats.messageRoles.${m.role}`)}
                  </span>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {content as string}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
