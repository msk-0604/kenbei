import type { PhotoClassification } from "./contract";

const WORK_HINTS: { key: string; name: string; pattern: RegExp }[] = [
  { key: "plumbing", name: "給排水", pattern: /給水|排水|配管|パイプ|HI\d+/i },
  { key: "sanitary", name: "衛生", pattern: /衛生|トイレ|便所|洗面/ },
  { key: "electrical", name: "電気", pattern: /電気|配線|盤|コンセント/ },
  { key: "hvac", name: "空調", pattern: /空調|ダクト|エアコン/ },
  { key: "fire_protection", name: "消防", pattern: /消防|スプリンクラー/ },
  { key: "interior", name: "内装", pattern: /内装|天井|ボード/ },
  { key: "painting", name: "塗装", pattern: /塗装|ペンキ/ },
  { key: "waterproofing", name: "防水", pattern: /防水/ },
  { key: "civil", name: "土木", pattern: /土木|掘削/ },
];

export function classifyPhotoHeuristic(fileName?: string): PhotoClassification {
  const text = fileName ?? "";
  const work = WORK_HINTS.find((item) => item.pattern.test(text));
  const floorMatch = text.match(/(\d+)\s*(階|F)/i);
  const toilet = /トイレ|便所/.test(text);
  const tags: string[] = [];
  if (work) {
    tags.push(work.name);
  }
  if (toilet) {
    tags.push("トイレ");
  }
  if (floorMatch?.[1]) {
    tags.push(`${floorMatch[1]}階`);
  }

  const confidence = work || floorMatch || toilet ? 0.62 : 0.2;
  return {
    categoryKey: work ? "in_progress" : "other",
    workType: work?.name,
    locationSpot: toilet ? "トイレ" : undefined,
    floor: floorMatch?.[1] ? `${floorMatch[1]}階` : undefined,
    description: work
      ? `${work.name}の施工写真（ファイル名からの候補）`
      : undefined,
    tags,
    confidence,
  };
}
