# 10. AI Service Layer設計

画面と Provider SDK を切り離す。KenSapo の判断の正は Graph と domain 計算であり、モデル出力ではない。

## 呼び出し規則

```
UI → BFF → Capture / Knowledge / Ingest のユースケース
                 ↓ 必要なときだけ
            packages/ai の AiService
                 ↓
            Provider Adapter
```

禁止:

- Client Component から OpenAI / Gemini / Anthropic を呼ぶ
- 原価・粗利・工期・時刻・権限・CRUD・通知判定・通常検索に LLM を使う
- モデル出力を `capture_fields.status = confirmed` で保存する

## インタフェース

```ts
export type AiProviderName = 'openai' | 'gemini' | 'anthropic';

export type Confidence = number; // 0..1

export type StructuredField<T> = {
  key: string;
  value: T;
  confidence: Confidence;
  needsConfirmation: boolean;
};

export interface TranscriptionInput {
  organizationId: string;
  mimeType: string;
  storagePath: string;
}

export interface CaptureContext {
  organizationId: string;
  projectId?: string;
  workOn: string;
  knownWorkerNames: string[];
  knownMaterialCodes: string[];
  knownLocationHints: string[];
  currentProcessNames: string[];
}

export interface AiService {
  transcribe(input: TranscriptionInput): Promise<{ text: string; provider: AiProviderName }>;

  structureCapture(
    transcript: string,
    context: CaptureContext
  ): Promise<{ fields: StructuredField<unknown>[]; provider: AiProviderName }>;

  classifyPhoto(input: {
    storagePath: string;
    context: CaptureContext;
  }): Promise<{ categoryKey: string; locationText?: string; confidence: Confidence }>;

  parseDocument(input: { storagePath: string; mimeType: string }): Promise<{
    text: string;
    fields: StructuredField<unknown>[];
  }>;

  summarize(text: string, purpose: 'report' | 'incident' | 'lesson'): Promise<string>;

  extractCautions(text: string): Promise<{ body: string; confidence: Confidence }[]>;

  embed(texts: string[]): Promise<number[][]>;
}
```

MVP 実装:

| メソッド | Provider 案 | 必須 |
|----------|-------------|------|
| transcribe | OpenAI Whisper または Gemini | 必須 |
| structureCapture | JSON schema 付き LLM | 必須 |
| classifyPhoto | まずルール。低信頼のみ LLM | 任意 |
| その他 | no-op または未接続 | 枠 |

`NullAiService` をテスト用に置く。CI は Provider なしで Capture の確認UIまで通す。

## Provider 交換

```
packages/ai/src/
  contract.ts
  factory.ts          # AI_PROVIDER=openai|gemini|anthropic
  providers/openai.ts
  providers/gemini.ts
  providers/anthropic.ts
  tracing.ts          # トークン数・latency を jobs/audit へ（本文は必要最小）
```

環境変数はサーバのみ。Org ごとに Provider を後から選べるよう `organization_settings.ai_provider` を予約する。

## コスト設計

| 処理 | 手段 | 備考 |
|------|------|------|
| 音声 | STT 1回 / キャプチャ | 長時間は分割 |
| 構造化 | LLM 1回 / キャプチャ | コンテキストにマスタを渡し幻覚を減らす |
| 写真 | EXIF + 当日セッションで 8割をルール | 残りだけビジョン |
| 類似 | ルールスコア | embed は Phase 2 |
| シグナル | ルール | LLM で「検知」しない |
| 日報文面 | テンプレート結合が主 | 要約LLMは任意 |

信頼度:

1. マスタ完全一致（材料コード、登録済み作業者名）→ 信頼度を底上げ、確認スキップ可
2. 数値+単位が文法的に取れた → 中〜高
3. 案件推定が複数候補 → 必ず確認
4. 閾値は `organization_settings.capture_auto_accept_threshold`（既定 0.90）

## structureCapture の出力例

入力: 「今日は3階の給水配管。田中と2人。HI25を12本使用。16時終了。明日続きを行います。」

```json
[
  { "key": "work_content", "value": "給水配管", "confidence": 0.93, "needsConfirmation": false },
  { "key": "location", "value": { "floor": 3 }, "confidence": 0.91, "needsConfirmation": false },
  { "key": "workers", "value": ["田中"], "confidence": 0.72, "needsConfirmation": true },
  { "key": "labor", "value": { "count": 2 }, "confidence": 0.88, "needsConfirmation": true },
  { "key": "materials", "value": [{ "code": "HI25", "qty": 12, "unit": "本" }], "confidence": 0.94, "needsConfirmation": false },
  { "key": "ended_at", "value": "16:00", "confidence": 0.90, "needsConfirmation": false },
  { "key": "next_plan", "value": "続き", "confidence": 0.80, "needsConfirmation": true },
  { "key": "daily_report", "value": "...", "confidence": 0.86, "needsConfirmation": false }
]
```

「田中」がマスタに1人だけなら確認を外してよい。同姓が2人なら必ず確認。HI25 が材料マスタに無いときだけ「HI25 12本で合っていますか？」を出す。

## 失敗時

STT/LLM 失敗でも音声ファイルと失敗ジョブは残す。ユーザーには「聞き取れませんでした。もう一度話すか、後で確認してください」。チャットに退避しない。
