/**
 * 業種ごとの「よく使う工程」の標準候補。管理画面で選んで会社の候補に読み込む。
 * 読み込んだあとは会社ごとに自由に直せる（progress_item_presets）。
 */
import { STANDARD_PROGRESS_ITEMS, type StandardProgressItem } from "@/lib/standard-progress-items";

export type TradeTemplate = { key: string; label: string; items: StandardProgressItem[] };

function stage(category: string, names: string[]): StandardProgressItem[] {
  return names.map((item_name) => ({ category, section: null, item_name }));
}

const CLOSING = stage("書類・引き渡し", ["完了写真", "施主・元請けの確認", "引き渡し", "請求書の提出"]);

export const TRADE_TEMPLATES: TradeTemplate[] = [
  { key: "plumbing", label: "水道・管工事", items: STANDARD_PROGRESS_ITEMS },
  {
    key: "electrical",
    label: "電気工事",
    items: [
      ...stage("準備", ["現場調査", "材料手配", "電力会社への申請"]),
      ...stage("先行配線", ["引込・幹線", "分電盤の取付", "コンセント配線", "照明配線", "弱電（LAN・TV・インターホン）", "スリーブ・ボックス"]),
      ...stage("仕上げ", ["器具付け（コンセント・スイッチ）", "照明器具の取付", "換気扇・エアコン専用回路", "アース工事"]),
      ...stage("検査", ["絶縁抵抗測定", "通電・動作確認", "竣工検査"]),
      ...CLOSING,
    ],
  },
  {
    key: "interior",
    label: "内装工事",
    items: [
      ...stage("準備", ["現場調査・採寸", "養生", "材料手配"]),
      ...stage("下地", ["解体・撤去", "軽鉄下地（LGS）", "ボード張り", "パテ処理"]),
      ...stage("仕上げ", ["クロス張り", "床（フローリング・CF・タイルカーペット）", "建具の取付", "巾木・見切り", "造作家具"]),
      ...stage("検査", ["クリーニング", "手直し", "社内検査"]),
      ...CLOSING,
    ],
  },
  {
    key: "exterior",
    label: "外構・エクステリア",
    items: [
      ...stage("準備", ["現場調査・測量", "近隣あいさつ", "材料手配"]),
      ...stage("土工事", ["掘削・すき取り", "残土処分", "砕石・転圧"]),
      ...stage("構造物", ["基礎", "ブロック積み", "フェンス・門扉", "カーポート・テラス"]),
      ...stage("仕上げ", ["土間コンクリート", "タイル・石張り", "植栽", "照明"]),
      ...CLOSING,
    ],
  },
  {
    key: "painting",
    label: "塗装工事",
    items: [
      ...stage("準備", ["近隣あいさつ", "足場の組立", "高圧洗浄", "養生"]),
      ...stage("下地", ["下地補修・クラック補修", "シーリング打ち替え", "ケレン"]),
      ...stage("塗装", ["下塗り", "中塗り", "上塗り", "付帯部（雨樋・破風・軒天）"]),
      ...stage("検査", ["色ムラ・塗り残しの確認", "手直し", "足場の解体"]),
      ...CLOSING,
    ],
  },
  {
    key: "hvac",
    label: "空調・設備工事",
    items: [
      ...stage("準備", ["現場調査", "機器・材料の手配", "スリーブ・インサート"]),
      ...stage("配管・ダクト", ["冷媒配管", "ドレン配管", "ダクト工事", "保温工事"]),
      ...stage("機器", ["室外機の据付", "室内機の取付", "換気扇・全熱交換器", "電源・制御配線"]),
      ...stage("試運転", ["気密試験", "真空引き", "試運転調整", "取扱説明"]),
      ...CLOSING,
    ],
  },
  {
    key: "demolition",
    label: "解体工事",
    items: [
      ...stage("準備", ["近隣あいさつ", "届出（建設リサイクル法など）", "ライフラインの停止確認", "足場・養生シート"]),
      ...stage("解体", ["内装材の撤去", "アスベスト調査・除去", "屋根材の撤去", "建物本体の解体", "基礎の撤去"]),
      ...stage("片付け", ["分別・搬出", "マニフェスト", "整地"]),
      ...CLOSING,
    ],
  },
  {
    key: "roofing",
    label: "屋根・板金工事",
    items: [
      ...stage("準備", ["現場調査", "足場の組立", "材料手配"]),
      ...stage("下地", ["既存屋根の撤去", "野地板", "ルーフィング（防水シート）"]),
      ...stage("仕上げ", ["屋根材張り", "棟・ケラバ・谷", "雨樋", "板金役物"]),
      ...stage("検査", ["散水・雨漏り確認", "清掃", "足場の解体"]),
      ...CLOSING,
    ],
  },
];

export function tradeTemplate(key: string): TradeTemplate | undefined {
  return TRADE_TEMPLATES.find((template) => template.key === key);
}
