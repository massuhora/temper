import type { Question } from "@/types"

export const SKETCH_TOPICS: string[] = [
  "如何提升远程团队的工作效率",
  "新产品上线后用户反馈不佳",
  "如何在忙碌中保持学习与成长",
  "领导临时要求提前交付项目",
  "职场新人如何快速融入团队",
  "一款健康管理 App 的产品定位",
  "客户对报价提出异议",
  "如何培养孩子的阅读习惯",
  "公司想要开拓下沉市场",
  "一次失败的跨部门协作经历",
  "如何说服团队采用新工具",
  "个人时间管理的困境与突破",
  "设计一款面向老年人的社交产品",
  "项目预算被削减一半怎么办",
  "如何处理与同事的意见分歧",
  "一家咖啡店的差异化竞争策略",
  "副业创业的机遇与风险",
  "如何在会议上清晰表达观点",
  "社区团购模式的可持续性分析",
  "职业倦怠期的自我调节方法",
]

export function generateSketchQuestion(framework: string): Question {
  const topic = SKETCH_TOPICS[Math.floor(Math.random() * SKETCH_TOPICS.length)]
  return {
    id: `sketch-${Date.now()}`,
    type: "限时结构速写",
    framework,
    content: `话题：${topic}。请使用 ${framework} 框架，在限定时间内完成结构化作答。`,
    title: topic,
    tags: ["速写"],
    difficulty: "中等",
    source: "系统生成",
    createdAt: new Date().toISOString(),
  }
}
