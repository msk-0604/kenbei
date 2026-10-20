import { memberFacingRoleLabel } from "@kensapo/domain";

/** 同じ名前のメンバーが何人かいるときは、権限を付けて見分けられるようにする（それでも同じなら番号）。 */
export function distinctMemberLabels(members: readonly { displayName: string; roleCode: string }[]): string[] {
  const count = (labels: string[]) => labels.reduce((map, label) => map.set(label, (map.get(label) ?? 0) + 1), new Map<string, number>());
  const names = members.map((member) => member.displayName);
  const nameCount = count(names);
  const withRole = members.map((member, index) =>
    (nameCount.get(names[index] ?? "") ?? 0) > 1 ? `${member.displayName}（${memberFacingRoleLabel(member.roleCode)}）` : member.displayName,
  );
  const roleCount = count(withRole);
  const seen = new Map<string, number>();
  return withRole.map((label) => {
    if ((roleCount.get(label) ?? 0) < 2) return label;
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return `${label} ${n}`;
  });
}
