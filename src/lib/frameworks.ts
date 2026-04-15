export interface Framework {
  id: string;
  name: string;
  focus: string;
}

// name and focus are now i18n keys; UI consumers should call t(name) and t(focus)
export const BUILTIN_FRAMEWORKS: Framework[] = [
  { id: "pyramid", name: "framework.pyramid.name", focus: "framework.pyramid.focus" },
  { id: "mece", name: "framework.mece.name", focus: "framework.mece.focus" },
  { id: "prep", name: "framework.prep.name", focus: "framework.prep.focus" },
  { id: "scqa", name: "framework.scqa.name", focus: "framework.scqa.focus" },
  { id: "5w2h", name: "framework.5w2h.name", focus: "framework.5w2h.focus" },
  { id: "logic-tree", name: "framework.logicTree.name", focus: "framework.logicTree.focus" },
];
