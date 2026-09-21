export function taskStatusButtonView(
  current: string,
  pending: string | null,
  value: string,
): { selected: boolean; updating: boolean; disabled: boolean } {
  return {
    selected: current === value,
    updating: pending === value,
    disabled: pending != null,
  };
}

export function taskStatusActionLabel(value: string, idleLabel: string): string {
  return value === "done" ? "完了にする" : idleLabel;
}

export function taskStatusSuccessMessage(value: string): string {
  if (value === "done") {
    return "✓ 完了しました";
  }
  if (value === "in_progress") {
    return "✓ 進行中にしました";
  }
  if (value === "review") {
    return "✓ 確認待ちにしました";
  }
  if (value === "todo") {
    return "✓ 未着手にしました";
  }
  return "✓ 更新しました";
}
