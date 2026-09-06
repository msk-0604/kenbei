# 3. DBテーブル一覧

PostgreSQL / Supabase。命名は snake_case、主キーは `uuid`。

## 全業務テーブル共通列

| 列 | 型 | 意味 |
|----|-----|------|
| `id` | uuid PK | |
| `organization_id` | uuid NOT NULL | テナント。RLS の軸 |
| `created_at` / `updated_at` | timestamptz | |
| `created_by` / `updated_by` | uuid | profiles |
| `deleted_at` | timestamptz | 論理削除。NULL が有効行 |

例外: `permissions`（グローバル辞書）、`system_catalogs`（グローバル辞書）、`profiles`（ユーザーは複数 Org に所属しうるため `organization_id` を持たない）。

## 一覧（設計対象）

MVP でマイグレーションするテーブルは ●。枠だけ用意するものは ○。

### A. テナント・組織

| テーブル | MVP | 目的 |
|----------|-----|------|
| `organizations` | ● | 最上位テナント |
| `organization_settings` | ● | 機能フラグ、入力省略の既定 |
| `organization_security_settings` | ● | SSO/SCIM/IP/端末/MFA の拡張枠 |
| `branches` | ● | 任意。零細は行を作らない |
| `departments` | ● | 任意。branch_id も任意 |
| `teams` | ● | 任意 |
| `profiles` | ● | auth.users 1:1 |
| `memberships` | ● | Org 内の所属・ロール |
| `roles` | ● | システムロール + Org カスタム |
| `permissions` | ● | 権限カタログ |
| `role_permissions` | ● | ロールへの権限割当 |
| `membership_project_access` | ● | Worker/Partner/Guest の案件スコープ |
| `partner_companies` | ● | 協力会社 |
| `user_qualifications` | ● | 保有資格 |

### B. マスタ

| テーブル | MVP | 目的 |
|----------|-----|------|
| `system_catalogs` | ● | 工種・建物種別・写真カテゴリ等の共通辞書 |
| `organization_catalogs` | ● | Org 独自・上書き |
| `materials` | ● | 材料マスタ（HI25 等）。インポート/使用で育つ |
| `customers` | ● | 顧客 |
| `customer_contacts` | ○ | 顧客担当 |

### C. Construction Graph（案件ハブ）

| テーブル | MVP | 目的 |
|----------|-----|------|
| `projects` | ● | 案件。Graph の中心 |
| `project_sites` | ● | 住所・地図・開始地点 |
| `project_work_types` | ● | 工種 |
| `project_members` | ● | 監督・作業員・事務・協力会社 |
| `project_financials` | ● | 請負・見積・予算・原価・売上・粗利 |
| `estimate_items` | ○ | 見積内訳 |
| `budget_items` | ○ | 実行予算内訳 |
| `cost_entries` | ● | 材料原価・外注費・その他実績 |
| `processes` | ● | 工程 |
| `process_progress` | ● | 進捗 |
| `labor_entries` | ● | 予定人工・実人工 |
| `material_usages` | ● | 使用材料 |
| `change_orders` | ● | 追加・変更工事 |
| `incidents` | ● | 手戻り・トラブル・クレーム |
| `incident_causes` | ● | 原因 |
| `incident_actions` | ● | 対処 |
| `project_outcomes` | ● | 完工結果・最終原価スナップ |
| `lessons` | ● | 教訓・次回注意（案件紐付け） |

### D. Zero Input / 現場オペレーション

| テーブル | MVP | 目的 |
|----------|-----|------|
| `site_sessions` | ● | 現場開始・終了 |
| `captures` | ● | 音声・写真・ボタンの生イベント |
| `capture_fields` | ● | 構造化候補 + 信頼度 + 確定状態 |
| `daily_reports` | ● | 生成物。手入力が主経路ではない |
| `photos` | ● | 写真メタ。フォルダ階層は持たない |
| `documents` | ● | PDF 等 |
| `document_extractions` | ○ | 文書解析結果 |

### E. 知識・類似・判断

| テーブル | MVP | 目的 |
|----------|-----|------|
| `knowledge_entries` | ● | 会社ノウハウ |
| `knowledge_links` | ● | 案件・工種・建物・作業・トラブルへ紐付け |
| `project_features` | ● | 類似判定用の正規化特徴 |
| `project_similarities` | ● | 類似結果キャッシュ |
| `signals` | ● | 推奨・注意・予測 |
| `signal_feedback` | ● | 人間の判断（採用/却下） |

### F. インポート・ジョブ・監査

| テーブル | MVP | 目的 |
|----------|-----|------|
| `import_jobs` | ● | CSV / 一括アップロード |
| `import_rows` | ● | 行単位の結果。本番テーブルと疎結合 |
| `jobs` | ● | 非同期ジョブ |
| `org_daily_snapshots` | ○ | 経営ダッシュボード用集計 |
| `audit_logs` | ● | 重要操作履歴 |

## 主要テーブルの列（レビュー用）

### organizations

| 列 | 内容 |
|----|------|
| `name` | 会社名 |
| `slug` | 一意 |
| `plan` | 将来課金。MVP は `standard` |
| `status` | active / suspended |

### memberships

| 列 | 内容 |
|----|------|
| `profile_id` | |
| `role_id` | |
| `branch_id` / `department_id` / `team_id` | すべて NULL 可 |
| `partner_company_id` | 協力会社所属時 |
| `status` | active / invited / disabled |

### projects（Graph ハブ）

| 列 | 内容 | 将来の判断 |
|----|------|------------|
| `customer_id` | 顧客 | |
| `code` / `name` | | |
| `status` | draft / active / on_hold / completed / cancelled | ダッシュボード |
| `building_type_key` | 建物種別 | 類似 |
| `work_summary` | 工事内容 | 類似・知識 |
| `scale_value` / `scale_unit` | 規模 | 類似 |
| `prefecture_code` / `city` / `area_label` | エリア | 類似 |
| `building_year` | 築年計算の元 | 類似 |
| `planned_start_on` / `planned_end_on` | 予定工期 | 遅延予測 |
| `actual_start_on` / `actual_end_on` | 実工期 | 類似平均 |
| `branch_id` / `department_id` | NULL 可 | |
| `source` | manual / csv / andpad / kanna / excel | 移行 |
| `external_ref` | 移行元 ID | 移行 |

請負金額・粗利は `project_financials` に分離し、案件一覧の類似スコア用に `project_features` へ非正規化する。

### captures / capture_fields

音声「今日は3階の給水配管…」は `captures` に原文を残し、分解結果は `capture_fields` へ。

| capture_fields 列 | 内容 |
|-------------------|------|
| `capture_id` | |
| `project_id` | 推定または確定 |
| `field_key` | work_content, location, workers, labor, materials, ended_at, next_plan, ... |
| `value_json` | 構造化値 |
| `confidence` | 0–1 |
| `status` | pending / auto_accepted / confirmed / corrected / rejected |
| `source` | speech / photo / tap / import / rule |

**無条件確定しない。** `auto_accepted` は閾値以上かつマスタ照合できた場合のみ。閾値未満は `pending` で確認UIへ。

### photos

フォルダパス列は持たない。

| 列 | 推定元の例 |
|----|------------|
| `project_id` | 当日セッション、GPS、ユーザー選択 |
| `taken_at` | EXIF / サーバ時刻 |
| `process_id` | 当日工程・音声 |
| `captured_by` | ログイン |
| `location_text` / `lat` / `lng` | EXIF・音声「3階」 |
| `category_key` | 着手前 / 施工中 / 完了 / 安全 / 材料 / その他 |
| `classification_confidence` | |
| `storage_path` | `{org_id}/projects/{project_id}/photos/{id}` |

### signals

| 列 | 内容 |
|----|------|
| `kind` | `recommendation` / `caution` / `prediction` のみ |
| `code` | labor_overrun, delay_risk, ... |
| `title` | UI表示文（「AI」を含まない） |
| `evidence_json` | 根拠（予定比、類似n件 等） |
| `severity` | low / medium / high |
| `detector` | rule:{id} または model:{id} |
| `status` | open / acknowledged / accepted / dismissed |
| `project_id` | |

## インデックス方針

ホットパスは必ず `(organization_id, ...)` から始める。

| 用途 | インデックス例 |
|------|----------------|
| 今日の現場 | `site_sessions (organization_id, work_on, membership_id)` |
| 案件ハブ | `projects (organization_id, status, planned_end_on)` |
| 写真 | `photos (organization_id, project_id, taken_at DESC)` |
| キャプチャ確認 | `capture_fields (organization_id, status) WHERE status = 'pending'` |
| 類似 | `project_features (organization_id, building_type_key, prefecture_code)` |
| シグナル | `signals (organization_id, status, severity, created_at DESC)` |
| 監査 | `audit_logs (organization_id, created_at DESC)` 将来パーティション |

ユニーク制約は論理削除と両立させる（部分ユニーク: `WHERE deleted_at IS NULL`）。

## 保存しないもの

- 画像バイナリ（Storage）
- ユーザー定義フォルダツリー
- LLM の生レスポンスを案件の正とするコピー（必要なら `captures.raw_ai_json` にデバッグ用として残し、正は `capture_fields`）
- テナントを跨ぐマテリアライズドビュー

列の完全な草案は [schema-draft.sql](./schema-draft.sql)。関係は [04-er.md](./04-er.md)。
