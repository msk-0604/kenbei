/**
 * 「よく使う項目」の標準候補（水道・管工事の紙の工事進行表）。
 * 会社ごとの候補（progress_item_presets）が登録されていない会社ではこれを使う。
 * 現場へ追加した時点で独立したコピーになる。
 */

export type StandardProgressItem = {
  category: string;
  section: string | null;
  item_name: string;
};

function cells(
  category: string,
  section: string | null,
  names: string[]
): StandardProgressItem[] {
  return names.map((item_name) => ({ category, section, item_name }));
}

function matrix(
  category: string,
  section: string | null,
  row: string,
  works: string[]
): StandardProgressItem[] {
  return works.map((work) => ({
    category,
    section,
    item_name: `${row}・${work}`,
  }));
}

const FLOOR_1 = "1階";
const FLOOR_2 = "2階";

const indoorFloor = (floor: string): StandardProgressItem[] => [
  ...matrix("屋内", floor, "キッチン", ["給水", "給湯", "排水", "ガス", "接続"]),
  ...matrix("屋内", floor, "浴室", ["給水", "給湯", "排水", "追焚き", "接続"]),
  ...matrix("屋内", floor, "洗面", ["給水", "給湯", "排水", "取付・接続"]),
  ...matrix("屋内", floor, "洗濯", ["給水", "給湯", "排水", "接続"]),
  ...matrix("屋内", floor, "トイレ", ["給水", "排水", "取付・接続"]),
  ...matrix("屋内", floor, "手洗い", ["給水", "給湯", "排水", "取付・接続"]),
];

function pressureItems(): StandardProgressItem[] {
  const items: StandardProgressItem[] = [];
  for (const target of ["外部", "内部", "器具"]) {
    for (const round of ["1回目", "2回目", "3回目"]) {
      items.push({
        category: "水圧テスト",
        section: target,
        item_name: round,
      });
    }
  }
  return items;
}

function documentItems(): StandardProgressItem[] {
  const items: StandardProgressItem[] = [];
  for (const kind of ["給水", "下水"]) {
    for (const doc of ["チェックリスト", "オーダー", "図面", "竣工図", "検査書類"]) {
      items.push({
        category: "申請書類",
        section: kind,
        item_name: doc,
      });
    }
  }
  return items;
}

export const PLACE_OPTIONS = ["屋外", "1階", "2階", "水圧テスト", "申請書類"] as const;
export const EQUIPMENT_OPTIONS = [
  "メーター周り・仮設",
  "水道立栓",
  "トイレ",
  "メーター周り",
  "土間逃げ",
  "土間給排水",
  "下水",
  "雨水",
  "給水",
  "ガス",
  "キッチン",
  "浴室",
  "洗面",
  "洗濯",
  "手洗い",
  "給湯器・エコキュート",
  "外部",
  "内部",
  "器具",
] as const;
export const WORK_OPTIONS = [
  "給水",
  "給湯",
  "排水",
  "ガス",
  "追焚き",
  "接続",
  "取付・接続",
  "主管",
  "1回目",
  "2回目",
  "3回目",
] as const;

export const STANDARD_PROGRESS_ITEMS: StandardProgressItem[] = [
  { category: "その他", section: null, item_name: "仕込" },
  ...cells("屋外", null, ["メーター周り・仮設", "水道立栓", "トイレ", "メーター周り"]),
  ...matrix("屋外", null, "土間逃げ", ["給水", "給湯", "排水", "スリーブ"]),
  ...matrix("屋外", null, "土間給排水", ["給水", "給湯", "排水", "ガス"]),
  ...matrix("屋外", null, "下水", ["主管", "公共桝接続", "桝", "桝調整"]),
  ...matrix("屋外", null, "雨水", ["主管", "桝", "接続", "桝調整"]),
  ...matrix("屋外", null, "給水", ["主管", "メーター接続", "散水", "水栓柱", "ガーデンパン"]),
  ...matrix("屋外", null, "ガス", ["主管", "メーター周り"]),
  ...indoorFloor(FLOOR_1),
  ...matrix("屋内", FLOOR_1, "給湯器・エコキュート", ["給水", "給湯", "排水", "ガス", "取付・接続"]),
  ...indoorFloor(FLOOR_2),
  ...pressureItems(),
  ...documentItems(),
];

export const PRINTED_FORM_NOTES = [
  "図面はラミネート加工すること",
  "工事完了した書類は完了BOXに必ず入れてください",
] as const;
