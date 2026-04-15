import i18n from "@/i18n";
import type { Message, Question } from "../types";

export function buildSystemPrompt(): Message {
  const lang = i18n.language;
  const dimConclusion = i18n.t('ai.dimensions.conclusionFirst');
  const dimMece = i18n.t('ai.dimensions.mece');
  const dimLogical = i18n.t('ai.dimensions.logicalProgression');
  const dimArgument = i18n.t('ai.dimensions.argumentStrength');
  const headerScores = i18n.t('ai.outputHeaders.dimensionScores');
  const headerIssues = i18n.t('ai.outputHeaders.issueList');
  const headerOptimized = i18n.t('ai.outputHeaders.optimizedVersion');
  const annotation = i18n.t('ai.annotation');
  const requirements = i18n.t('ai.requirements');

  const taskIntro = lang === 'zh'
    ? '你的任务是严格按照以下四个维度评估用户的作答，并给出具体、可执行的改进建议，不允许泛泛表扬。'
    : "Your task is to evaluate the user's answer strictly according to the following four dimensions, and provide specific, actionable improvement suggestions. Vague praise is not allowed.";
  const evalTitle = lang === 'zh' ? '评估维度：' : 'Evaluation Dimensions:';
  const outputTitle = lang === 'zh' ? '输出格式（必须严格遵守）：' : 'Output Format (must strictly follow):';
  const scoreHeader = i18n.t('ai.outputHeaders.score');
  const evalHeader = i18n.t('ai.outputHeaders.evaluation');
  const issueExample = lang === 'zh'
    ? '问题 1：具体描述缺陷所在位置及原因'
    : 'Issue 1: Specifically describe the location and cause of the defect';
  const optimizedIntro = lang === 'zh'
    ? '【在这里给出优化后的完整文本，并采用以下标注方式说明修改点】'
    : '[Provide the optimized full text here, and use the following annotation format to explain the edit points]';
  const reqPrefix = lang === 'zh' ? '要求：' : 'Requirements:';
  const dimLabel = lang === 'zh' ? '维度' : 'Dimension';
  const placeholderOptimized = lang === 'zh' ? '优化后的正文...' : 'Optimized main text...';

  return {
    role: "system",
    content: `${i18n.t('ai.systemRole')}

${taskIntro}

${evalTitle}
1. ${dimConclusion} — ${lang === 'zh' ? '核心结论是否在开篇就清晰呈现，是否以上统下。' : 'Whether the core conclusion is clearly presented at the beginning and supported top-down.'}
2. ${dimMece} — ${lang === 'zh' ? '分类是否相互独立、完全穷尽，有无重叠或遗漏。' : 'Whether categories are mutually exclusive and collectively exhaustive, with no overlap or omission.'}
3. ${dimLogical} — ${lang === 'zh' ? '论点与论据之间是否存在清晰的逻辑关系（时间、结构、重要性）。' : 'Whether there is a clear logical relationship between arguments and evidence (time, structure, importance).'}
4. ${dimArgument} — ${lang === 'zh' ? '支撑结论的事实、数据、例子是否足够、具体、可信。' : 'Whether the facts, data, and examples supporting the conclusion are sufficient, specific, and credible.'}

${outputTitle}

\`\`\`markdown
## ${headerScores}

| ${dimLabel} | ${scoreHeader} | ${evalHeader} |
|---|---|---|
| ${dimConclusion} | 1-10 | ... |
| ${dimMece} | 1-10 | ... |
| ${dimLogical} | 1-10 | ... |
| ${dimArgument} | 1-10 | ... |

## ${headerIssues}

- ${issueExample}
- ${lang === 'zh' ? '问题 2：...' : 'Issue 2: ...'}

## ${headerOptimized}

${optimizedIntro}

> ${annotation} 1：...
> ${annotation} 2：...

${placeholderOptimized}
\`\`\`

${reqPrefix}
- ${requirements}`,
  };
}

export function buildSystemPromptForType(
  type: string,
  options?: { autoSubmitted?: boolean; blindMode?: boolean; userSelectedFramework?: string }
): Message {
  const base = buildSystemPrompt().content;

  let emphasis = "";
  switch (type) {
    case "诊断改错题":
      emphasis = i18n.t('ai.typeInstructions.diagnostic');
      break;
    case "分类重构题":
      emphasis = i18n.t('ai.typeInstructions.categorization');
      break;
    case "限时结构速写":
      emphasis = i18n.t('ai.typeInstructions.sketch');
      break;
    case "自定义真题":
      emphasis = i18n.t('ai.typeInstructions.custom');
      break;
    default:
      emphasis = i18n.t('ai.typeInstructions.default');
  }

  if (options?.autoSubmitted) {
    emphasis += "\n" + i18n.t('ai.autoSubmitNote');
  }

  if (options?.blindMode && options?.userSelectedFramework) {
    const dim = i18n.t('ai.blindModeDimension');
    const blindText = i18n.language === 'zh'
      ? `本题采用框架盲选模式。用户在没有被告知标准框架的情况下，自行选择了【${options.userSelectedFramework}】框架。请在评估中增加一个维度『${dim}』，判断该选择是否适合本题场景。如果不合适，请指出更适合的框架。`
      : `This question uses blind framework selection. The user chose the [${options.userSelectedFramework}] framework without being told the standard framework. Please add an additional dimension [${dim}] to your evaluation to judge whether this choice is suitable for the scenario. If not, please point out a more suitable framework.`;
    emphasis += "\n" + blindText;
  }

  return {
    role: "system",
    content: `${base}\n\n${emphasis}`,
  };
}

export function buildUserPrompt(
  question: Question,
  userAnswer: string,
  typeHint?: string,
  outline?: string,
  options?: { autoSubmitted?: boolean; userSelectedFramework?: string }
): Message {
  const framework = question.framework || i18n.t('ai.userPrompt.unspecifiedFramework');
  const content = question.content || "";
  const hintPrefix = typeHint ? `【${i18n.t('ai.userPrompt.typeLabel')}】${typeHint}\n\n` : "";
  const outlineBlock = outline ? `【${i18n.t('ai.userPrompt.outlineLabel')}】\n${outline}\n\n` : "";
  const autoSubmittedHint = options?.autoSubmitted
    ? `${i18n.t('ai.userPrompt.autoSubmitStatus')}\n\n`
    : "";
  const frameworkHint = options?.userSelectedFramework
    ? `【${i18n.t('ai.userPrompt.userSelectedFramework')}】${options.userSelectedFramework}\n\n`
    : "";

  return {
    role: "user",
    content: `${hintPrefix}${autoSubmittedHint}${frameworkHint}【${i18n.t('ai.userPrompt.frameworkLabel')}】${framework}

【${i18n.t('ai.userPrompt.questionContentLabel')}】
${content}

${outlineBlock}【${i18n.t('ai.userPrompt.answerLabel')}】
${userAnswer}

${i18n.t('ai.userPrompt.evaluationRequest')}`,
  };
}

export function buildIteratePrompt(
  previousMessages: Message[],
  newAnswer: string,
  outline?: string,
  options?: { userSelectedFramework?: string }
): Message[] {
  const outlineBlock = outline ? `【${i18n.t('ai.userPrompt.outlineLabel')}】\n${outline}\n\n` : "";
  const frameworkHint = options?.userSelectedFramework
    ? `【${i18n.t('ai.userPrompt.userSelectedFramework')}】${options.userSelectedFramework}\n\n`
    : "";
  return [
    ...previousMessages,
    {
      role: "user",
      content: `${i18n.t('ai.userPrompt.iteratePrefix')}

${frameworkHint}${outlineBlock}【${i18n.t('ai.userPrompt.newAnswerLabel')}】
${newAnswer}`,
    },
  ];
}

export function buildGenerateQuestionPrompt(
  document: string,
  type: string,
  framework: string
): Message[] {
  const lang = i18n.language;
  const systemContent = lang === 'zh'
    ? `你是一位结构化思维教练，请根据用户提供的真实工作文档，生成一道结构化思维训练题目。

要求：
- 仔细阅读文档，提取其中的业务场景、问题或表达内容
- 根据目标题型和框架，设计一道贴合实际的训练题目
- 题目应具有明确的训练目标和可评估的标准
- 提供详细的参考答案，帮助用户对照学习

输出格式（必须严格遵守）：
返回纯 JSON 对象，不要包含 markdown 代码块标记或其他说明文字。JSON 格式如下：
{
  "id": "题目唯一标识（建议使用简短英文或数字）",
  "type": "题型",
  "framework": "框架",
  "difficulty": "难度（如 简单/中等/困难）",
  "tags": ["标签1", "标签2"],
  "content": "题目内容（包含背景描述和具体要求）",
  "referenceAnswer": "参考答案"
}`
    : `You are a structured thinking coach. Please generate a structured thinking training question based on the real work document provided by the user.

Requirements:
- Carefully read the document and extract business scenarios, problems, or expressions
- Design a practical training question according to the target type and framework
- The question should have clear training objectives and evaluable criteria
- Provide a detailed reference answer to help users learn by comparison

Output format (must strictly follow):
Return a pure JSON object without markdown code block markers or other explanatory text. JSON format:
{
  "id": "Question unique identifier (short English or numbers recommended)",
  "type": "Question type",
  "framework": "Framework",
  "difficulty": "Difficulty (e.g. Easy/Medium/Hard)",
  "tags": ["tag1", "tag2"],
  "content": "Question content (including background description and specific requirements)",
  "referenceAnswer": "Reference answer"
}`;

  return [
    {
      role: "system",
      content: systemContent,
    },
    {
      role: "user",
      content: `【${i18n.t('ai.userPrompt.genDocumentLabel')}】
${document}

【${i18n.t('ai.userPrompt.genTargetTypeLabel')}】${type}
【${i18n.t('ai.userPrompt.genTargetFrameworkLabel')}】${framework}

${i18n.t('ai.userPrompt.genInstruction')}`,
    },
  ];
}
