export const colors = {
  paper: "#F4F6F8",
  ink: "#0F172A",
  line: "#D6DDE6",
  muted: "#64748B",
  card: "#FFFFFF",
  accent: "#0F172A",
  warn: "#B45309",
  danger: "#B91C1C",
} as const;

export const brand = {
  name: "KENBEI",
  reading: "ケンベイ",
  tagline: "現場に、軍師を。",
} as const;

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: "準備中",
  active: "施工中",
  on_hold: "一時停止",
  completed: "完了",
  cancelled: "中止",
};
