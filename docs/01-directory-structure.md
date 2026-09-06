# 1. 推奨ディレクトリ構成

実装は **pnpm workspace モノレポ** とします。Web（Next.js PWA）と将来の React Native / Expo が、ドメイン・AI・Decision Engine・Importer を共有するためです。

小規模企業向けの単一 Next.js リポジトリに見えるように、初期は `apps/web` だけをデプロイします。`apps/mobile` は Phase 3 まで空枠です。

```
kensapo/
├── apps/
│   └── web/                          # Next.js App Router + PWA
│       ├── app/                      # ルート / 画面（薄い）
│       │   ├── (auth)/
│       │   ├── (field)/              # 現場ユーザー: Today がホーム
│       │   ├── (manage)/             # 管理職・経営・事務
│       │   ├── (partner)/            # 協力会社（必要最小）
│       │   └── api/                  # BFF。UIから AI Provider を呼ばない
│       ├── public/
│       └── src/
│           ├── app-shell/            # ナビ・ロール別シェル
│           └── pwa/
├── packages/
│   ├── domain/                       # 型・不変条件・計算（粗利等はここ。AI禁止）
│   ├── db/                           # Supabase クライアント・Repository
│   ├── authz/                        # RBAC 判定
│   ├── ai/                           # AI Service Layer（Provider 交換点）
│   ├── similar-projects/             # Similar Projects Engine
│   ├── decision-engine/              # シグナル検出（ルール優先）
│   ├── ingest/                       # インポートパイプライン（CSV → 将来各社Importer）
│   ├── graph/                        # Construction Graph の読み書き境界
│   └── ui/                           # 大きなボタン等の共有プリミティブ
├── supabase/
│   ├── migrations/
│   ├── policies/                     # RLS（マイグレーションから参照）
│   └── seed/
├── docs/                             # 本設計書
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

## アプリ内の機能配置（apps/web）

画面はロールで分け、機能モジュールは「記録」ではなく「判断ループ」で切る。

```
apps/web/src/features/
├── today/                  # 今日（現場ホーム）
├── capture/                # 撮る・話す・押す
├── photos/                 # フォルダを作らせない写真
├── project/                # 案件ハブ（Graph の入口）
├── management/             # 今確認すべきこと
├── knowledge/              # 会社の施工知識
├── similar/                # 類似案件の提示
├── signals/                # 推奨 / 注意 / 予測
└── import/                 # 乗り換え
```

## 置かないもの

| 置かない | 理由 |
|----------|------|
| `components/ai/*` を画面から直接呼ぶ | Provider 漏洩・コスト爆発・UIに「AI」が染みる |
| 画面ごとの `fetch('https://api.openai.com')` | AI Service Layer 違反 |
| `pages/` ルーター | App Router に統一 |
| 巨大な `lib/utils.ts` | ドメイン計算は `packages/domain` |
| ユーザーが作るフォルダツリーUI | 写真は仮想分類 |

## 画面は薄く、判断はパッケージへ

```
UI（apps/web）
  → Route Handler / Server Action
    → packages/graph | decision-engine | similar-projects | ingest
      → packages/domain（計算）
      → packages/ai（必要なときだけ）
      → packages/db（永続化）
```

React コンポーネントは表示と確認UI（はい / 修正）だけを持ちます。原価・粗利・工期・権限はすべて `packages/domain` と `packages/authz` です。

## 小規模企業への見え方

ディレクトリ上は Branch / Department がありますが、UI は **Organization → Project → User** だけで完結できます。Branch / Department は未設定（NULL）を正式な運用モードとします。

## 将来のモバイル

```
apps/mobile/          # Expo（Phase 3）
  → packages/domain
  → packages/ai は呼ばない（BFF 経由）
  → 同一 API（apps/web/app/api または独立 API ルート）
```

ネイティブアプリは AI Provider キーを持ちません。
