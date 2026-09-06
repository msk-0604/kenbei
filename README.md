# KENBEI

現場が終わってからの1〜2時間を、10〜15分にする。施工管理者・現場監督・工事責任者・中小建設会社向けの施工管理SaaSです。

> **写真を上げる → 自動で整理される → 日報ができる → 確認して出す。**

KENBEI は AI を前面に出しません。現場写真と日報を速くまとめる道具として使い、整理と下書きは内側で手伝います。確定は必ず人が行います。

## いまの状態

月額55,000円で導入できる水準を目指し、次を実装済みです。

- 現場 / 写真（オフライン待ち行列つき） / 日報 / 工程 / タスク / 確認待ち / 社内資料
- 会社設定（表示名・ロゴ）とメンバー招待
- 提出用A4印刷、マルチテナント RLS

## ローカル起動

必要: Node.js 20+、pnpm 10。

```bash
pnpm install
cp .env.example apps/web/.env.local
```

Supabase の migration をファイル名順に適用してください（空のプロジェクトなら全部）。

Phase 2 以降の例:

- `20260903100000_ops_site_management.sql`
- `20260903200000_kenbei_invites.sql`
- `20260903210000_kenbei_phase2.sql`
- `20260904100000_kenbei_phase24_push_drawings.sql`
- `20260904120000_kenbei_phase25_210.sql`
- `20260904140000_kenbei_rc1.sql`

```bash
pnpm dev
```

1. `/signup` でアカウント作成
2. `/onboarding` で会社作成（Owner）
3. 会社設定でメンバー招待・ロゴ設定
4. 現場作成 → 写真アップロード → 今日の日報 → 確認 → 確定 → 印刷

AI キーは任意です。未設定でもテンプレートとファイル名推定で動作します。キーがあると写真の中身推定と日報文章が強くなります。

## 本番で必要な設定

詳細はルートの `.env.example` を参照。

- **必須（コア）:** `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_APP_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- **課金:** FREE 1〜3名 0円 / STANDARD 4〜30名 月額39,800円 / BUSINESS 31〜50名 月額65,000円 / 51名以上は要相談。ENV は `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_STANDARD` / `STRIPE_PRICE_BUSINESS`。Webhook は `/api/stripe/webhook`
- **本番URL:** `https://app.kenbei.jp`（`NEXT_PUBLIC_APP_URL` / `EXPO_PUBLIC_APP_URL`）
- **日本語サーバーPDF:** `apps/web/fonts/NotoSansJP-Regular.ttf` を置くか `PDF_FONT_PATH`（TTF/OTF。`.ttc` 不可）。未設定時は文字化けPDFを出さず 422
- **Mobile:** `EXPO_PUBLIC_*` のみ。Service Role / Stripe / OpenAI を入れない
- Expo Push は実機 + EAS `projectId` が必要です

## 検証

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## ブランド

正式サービス名は **KENBEI** です。
