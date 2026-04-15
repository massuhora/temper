import { useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  Save,
  Upload,
  FileArchive,
  FileText,
  FolderUp,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { db } from "@/db";
import {
  exportQuestionsToZip,
  exportMistakesToMarkdown,
  exportFullBackupZip,
  generateWeakPointsMarkdown,
} from "@/services/markdownExport";
import { importFromFiles } from "@/services/markdownImport";
import { buildGenerateQuestionPrompt } from "@/services/aiPrompts";
import { BUILTIN_FRAMEWORKS } from "@/lib/frameworks";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Question, PracticeRecord, Principle } from "@/types";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useTranslation } from "react-i18next";

async function downloadBlob(blob: Blob, filename: string) {
  const path = await save({ defaultPath: filename });
  if (path) {
    const arrayBuffer = await blob.arrayBuffer();
    await writeFile(path, new Uint8Array(arrayBuffer));
  }
}

async function downloadText(text: string, filename: string) {
  const path = await save({ defaultPath: filename });
  if (path) {
    await writeTextFile(path, text);
  }
}

function frameworkKey(id: string) {
  return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export function DataManagement() {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("https://api.deepseek.com/v1");
  const [mistakeThreshold, setMistakeThreshold] = useState(6);
  const [practiceDurationSeconds, setPracticeDurationSeconds] = useState(300);
  const [defaultModel, setDefaultModel] = useState("deepseek-chat");
  const [strictSketchMode, setStrictSketchMode] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [strategy, setStrategy] = useState<"overwrite" | "skip">("skip");
  const [importResult, setImportResult] = useState<{
    added: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const setFolderInputRef = (el: HTMLInputElement | null) => {
    if (el) {
      el.setAttribute("webkitdirectory", "true");
      el.setAttribute("directory", "true");
      folderInputRef.current = el;
    }
  };

  const [questions, setQuestions] = useState<Question[]>([]);
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [genDocument, setGenDocument] = useState("");
  const [genType, setGenType] = useState("自定义真题");
  const [genFramework, setGenFramework] = useState(BUILTIN_FRAMEWORKS[0].name);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    ;(async () => {
      const [s, q, r, p] = await Promise.all([
        db.getSettings(),
        db.getAllQuestions(),
        db.getAllRecords(),
        db.getAllPrinciples(),
      ]);
      if (!mounted) return;
      setApiKey(s?.deepseekApiKey || "");
      setApiUrl(s?.deepseekApiUrl || "https://api.deepseek.com/v1");
      setMistakeThreshold(s?.mistakeThreshold ?? 6);
      setPracticeDurationSeconds(s?.practiceDurationSeconds ?? 300);
      setDefaultModel(s?.defaultModel || "deepseek-chat");
      setStrictSketchMode(s?.strictSketchMode ?? false);
      setQuestions(q);
      setRecords(r);
      setPrinciples(p);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveSettings = async () => {
    await db.updateSettings({
      deepseekApiKey: apiKey.trim() || undefined,
      deepseekApiUrl: apiUrl.trim() || undefined,
      mistakeThreshold,
      practiceDurationSeconds,
      defaultModel: defaultModel.trim() || undefined,
      strictSketchMode,
    });
    toast.success(t("data.toast.settingsSaved"));
  };

  const processFiles = async (files: File[]) => {
    const targetFiles = files.filter(
      (f) => f.name.endsWith(".md") || f.name.endsWith(".zip")
    );
    if (targetFiles.length === 0) return;
    const {
      questions: mergedQ,
      records: mergedR,
      principles: mergedP,
      result,
    } = await importFromFiles(targetFiles, questions, records, principles, strategy);
    setImportResult(result);

    for (const q of mergedQ) {
      const existing = await db.getQuestionById(q.id);
      if (existing) {
        await db.updateQuestion(q.id, q);
      } else {
        await db.addQuestion(q);
      }
    }

    for (const r of mergedR) {
      const existing = await db.getRecordById(r.id);
      if (existing) {
        await db.updateRecord(r.id, r);
      } else {
        await db.addRecord(r);
      }
    }

    for (const p of mergedP) {
      const existing = await db.getPrincipleById(p.id);
      if (existing) {
        await db.updatePrinciple(p.id, p);
      } else {
        await db.addPrinciple(p);
      }
    }

    setQuestions(mergedQ);
    setRecords(mergedR);
    setPrinciples(mergedP);
    toast.success(
      t("data.toast.importComplete", {
        added: result.added,
        skipped: result.skipped,
      })
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
    if (e.target) e.target.value = "";
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.name.endsWith(".md")
    );
    await processFiles(files);
    if (e.target) e.target.value = "";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  };

  const handleExportZip = async () => {
    if (questions.length === 0) {
      toast.error(t("data.toast.emptyBankNoExport"));
      return;
    }
    const blob = await exportQuestionsToZip(questions);
    await downloadBlob(blob, `temper-questions-${new Date().toISOString().slice(0, 10)}.zip`);
    toast.success(t("data.toast.questionsExported"));
  };

  const handleExportMistakes = async () => {
    const md = exportMistakesToMarkdown(questions, records);
    await downloadText(md, `temper-mistakes-${new Date().toISOString().slice(0, 10)}.md`);
    toast.success(t("data.toast.mistakesExported"));
  };

  const handleExportFullBackup = async () => {
    const weakPoints = generateWeakPointsMarkdown(records, questions);
    const blob = await exportFullBackupZip(questions, records, principles, weakPoints);
    await downloadBlob(blob, `temper-backup-${new Date().toISOString().slice(0, 10)}.zip`);
    toast.success(t("data.toast.backupExported"));
  };

  const handleClearData = async () => {
    await db.clearAllData();
    window.location.reload();
  };

  const handleGenerate = async () => {
    if (!genDocument.trim()) {
      toast.error(t("data.toast.pasteDocumentFirst"));
      return;
    }
    if (!apiKey.trim()) {
      toast.error(t("data.toast.configureApiKeyFirst"));
      return;
    }

    setIsGenerating(true);
    try {
      const messages = buildGenerateQuestionPrompt(
        genDocument.trim(),
        genType,
        genFramework
      );
      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: defaultModel,
          messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "Unknown error");
        throw new Error(`API error ${response.status}: ${text}`);
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || "";
      const cleaned = raw
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/```$/, "")
        .trim();
      const parsed = JSON.parse(cleaned);

      const question: Question = {
        id: parsed.id || crypto.randomUUID(),
        type: parsed.type || genType,
        framework: parsed.framework || genFramework,
        difficulty: parsed.difficulty || "中等",
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        content: parsed.content || "",
        referenceAnswer: parsed.referenceAnswer || "",
        createdAt: new Date().toISOString(),
      };

      await db.addQuestion(question);
      toast.success(t("data.toast.questionsGenerated"));
      setGenDocument("");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `${t("data.toast.generationFailed")}: ${err.message}`
          : t("data.toast.generationFailed")
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-6 overflow-auto p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {t("data.title")}
        </h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">
          {t("data.subtitle")}
        </p>
      </div>

      {/* API 设置 */}
      <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
        <CardHeader className="pb-4">
          <CardTitle className="font-display text-lg font-semibold tracking-tight text-card-foreground">
            {t("data.apiSettings")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="api-key" className="font-body text-sm text-foreground">
              {t("data.apiKey")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKey((v) => !v)}
                className="active:scale-95"
                aria-label={showKey ? t("common.hide") : t("common.show")}
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="api-url" className="font-body text-sm text-foreground">
              {t("data.apiUrl")}
            </Label>
            <Input
              id="api-url"
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1"
              className="flex-1"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="default-model" className="font-body text-sm text-foreground">
              {t("data.defaultModel")}
            </Label>
            <Input
              id="default-model"
              type="text"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              placeholder="deepseek-chat"
              className="flex-1"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mistake-threshold" className="font-body text-sm text-foreground">
                {t("data.mistakeThreshold")}
              </Label>
              <Input
                id="mistake-threshold"
                type="number"
                value={mistakeThreshold}
                onChange={(e) => setMistakeThreshold(Number(e.target.value))}
                placeholder="6"
                className="flex-1"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="practice-duration" className="font-body text-sm text-foreground">
                {t("data.practiceDuration")}
              </Label>
              <Input
                id="practice-duration"
                type="number"
                value={practiceDurationSeconds}
                onChange={(e) => setPracticeDurationSeconds(Number(e.target.value))}
                placeholder="300"
                className="flex-1"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-body text-sm text-foreground">{t("data.strictSketchMode")}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={strictSketchMode ? "outline" : "default"}
                size="sm"
                onClick={() => setStrictSketchMode(false)}
                className="active:scale-95"
              >
                {t("data.gentleMode")}
              </Button>
              <Button
                type="button"
                variant={strictSketchMode ? "default" : "outline"}
                size="sm"
                onClick={() => setStrictSketchMode(true)}
                className="active:scale-95"
              >
                {t("data.strictMode")}
              </Button>
            </div>
            <p className="font-body text-xs text-muted-foreground">
              {t("data.strictSketchHelper")}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} className="gap-2 active:scale-95">
              <Save className="size-4" />
              {t("data.saveSettings")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据导入 */}
      <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
        <CardHeader className="pb-4">
          <CardTitle className="font-display text-lg font-semibold tracking-tight text-card-foreground">
            {t("data.dataImport")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="font-body text-sm text-foreground">{t("data.mergeStrategy")}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={strategy === "skip" ? "default" : "outline"}
                size="sm"
                onClick={() => setStrategy("skip")}
                className="active:scale-95"
              >
                {t("data.skipDuplicate")}
              </Button>
              <Button
                type="button"
                variant={strategy === "overwrite" ? "default" : "outline"}
                size="sm"
                onClick={() => setStrategy("overwrite")}
                className="active:scale-95"
              >
                {t("data.overwriteDuplicate")}
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".md"
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={setFolderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFolderSelect}
          />
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/50"
            )}
          >
            <p className="font-body text-sm text-muted-foreground">
              {t("data.dropZone")}
            </p>
            <p className="mt-1 font-body text-xs text-muted-foreground">
              {t("data.dropZoneHelper")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-fit gap-2 active:scale-95"
            >
              <Upload className="size-4" />
              {t("data.importMd")}
            </Button>
            <Button
              variant="outline"
              onClick={() => zipInputRef.current?.click()}
              className="w-fit gap-2 active:scale-95"
            >
              <FileArchive className="size-4" />
              {t("data.importZip")}
            </Button>
            <Button
              variant="outline"
              onClick={() => folderInputRef.current?.click()}
              className="w-fit gap-2 active:scale-95"
            >
              <FolderUp className="size-4" />
              {t("data.importFolder")}
            </Button>
          </div>

          {importResult && (
            <div className="rounded-md border border-border bg-muted p-3">
              <p className="font-body text-sm text-foreground">
                {t("data.importResult", {
                  added: importResult.added,
                  skipped: importResult.skipped,
                })}
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-4 font-body text-xs text-destructive">
                  {importResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 基于工作文档生成题目 */}
      <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
        <CardHeader className="pb-4">
          <CardTitle className="font-display text-lg font-semibold tracking-tight text-card-foreground">
            {t("data.generateQuestions")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="gen-document"
              className="font-body text-sm text-foreground"
            >
              {t("data.workDocument")}
            </Label>
            <Textarea
              id="gen-document"
              value={genDocument}
              onChange={(e) => setGenDocument(e.target.value)}
              placeholder={t("data.workDocumentPlaceholder")}
              className="min-h-[160px]"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="gen-type"
                className="font-body text-sm text-foreground"
              >
                {t("data.targetType")}
              </Label>
              <select
                id="gen-type"
                value={genType}
                onChange={(e) => setGenType(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="诊断改错题">{t("questionType.diagnostic")}</option>
                <option value="分类重构题">{t("questionType.categorization")}</option>
                <option value="自定义真题">{t("questionType.custom")}</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="gen-framework"
                className="font-body text-sm text-foreground"
              >
                {t("data.targetFramework")}
              </Label>
              <select
                id="gen-framework"
                value={genFramework}
                onChange={(e) => setGenFramework(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {BUILTIN_FRAMEWORKS.map((f) => (
                  <option key={f.id} value={f.name}>
                    {t(`framework.${frameworkKey(f.id)}.name`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !genDocument.trim()}
              className="gap-2 active:scale-95"
            >
              {isGenerating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              {isGenerating ? t("data.generating") : t("data.generate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据导出 */}
      <Card className="rounded-lg border border-border bg-card shadow-elevation-2">
        <CardHeader className="pb-4">
          <CardTitle className="font-display text-lg font-semibold tracking-tight text-card-foreground">
            {t("data.dataExport")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            variant="outline"
            onClick={handleExportZip}
            className="w-fit gap-2 active:scale-95"
          >
            <FileArchive className="size-4" />
            {t("data.exportAllZip")}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportMistakes}
            className="w-fit gap-2 active:scale-95"
          >
            <FileText className="size-4" />
            {t("data.exportMistakesMd")}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportFullBackup}
            className="w-fit gap-2 active:scale-95"
          >
            <FileArchive className="size-4" />
            {t("data.exportBackupZip")}
          </Button>
        </CardContent>
      </Card>

      {/* 危险操作 */}
      <Card className="rounded-lg border border-destructive/20 bg-card shadow-elevation-2">
        <CardHeader className="pb-4">
          <CardTitle className="font-display text-lg font-semibold tracking-tight text-destructive">
            {t("common.dangerZone")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="gap-2 active:scale-95">
                <Trash2 className="size-4" />
                {t("data.clearDataButton")}
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-lg border border-border bg-popover">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display text-lg font-semibold text-popover-foreground">
                  <AlertTriangle className="size-5 text-destructive" />
                  {t("data.clearDataTitle")}
                </DialogTitle>
                <DialogDescription className="font-body text-sm text-popover-foreground/80">
                  {t("data.clearDataDesc")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="active:scale-95"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleClearData}
                  className="active:scale-95"
                >
                  {t("common.confirm")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <div className="h-6" />
    </div>
  );
}
