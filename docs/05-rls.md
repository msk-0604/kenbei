# 5. RLS設計

企業向けSaaSとして、**アプリケーションの WHERE 句だけに頼らない**。PostgREST / ブラウザクライアント経由の読書きはすべて RLS で拒否できる状態にする。

## 原則

1. 業務テーブルは `organization_id` 必須。他テナント行は存在しないかのように見える。
2. `deleted_at IS NOT NULL` は通常ロールから見えない。
3. 案件スコープ付きロール（Worker / Partner / Guest）は、所属 Org 内でも未割当案件を見えない。
4. `service_role` はサーバの Ingest / バッチ / 監査書き込みのみ。画面用クライアントに渡さない。
5. Storage も同等のパス規約とポリシー。

## セッションから拾うもの

Supabase Auth の JWT。`profiles.id = auth.uid()`。

ヘルパー（`SECURITY DEFINER`、`SET search_path = public`）:

```sql
-- 有効な所属 Org
auth_organization_ids() RETURNS SETOF uuid

-- 指定 Org で有効な membership
auth_membership(org_id uuid)

-- 権限コードを持つか
auth_has_permission(org_id uuid, permission_code text) RETURNS boolean

-- 案件にアクセスできるか
auth_can_access_project(org_id uuid, project_id uuid) RETURNS boolean
```

`auth_can_access_project`:

- 権限 `project.read_all` があれば Org 内全案件（論理削除除く）
- なければ `membership_project_access` または `project_members` に含まれる案件のみ

## ポリシー雛形

すべてのテナントテーブルに同じ骨格を適用する。

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY projects_select ON projects
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND organization_id IN (SELECT auth_organization_ids())
  AND auth_can_access_project(organization_id, id)
);

-- INSERT
CREATE POLICY projects_insert ON projects
FOR INSERT TO authenticated
WITH CHECK (
  organization_id IN (SELECT auth_organization_ids())
  AND auth_has_permission(organization_id, 'project.create')
);

-- UPDATE
CREATE POLICY projects_update ON projects
FOR UPDATE TO authenticated
USING (
  deleted_at IS NULL
  AND auth_has_permission(organization_id, 'project.update')
  AND auth_can_access_project(organization_id, id)
)
WITH CHECK (organization_id IN (SELECT auth_organization_ids()));

-- DELETE は物理削除せず、update で deleted_at を立てる。
-- 物理 DELETE ポリシーは付けない（または Owner のみ）。
```

子テーブル（photos, labor_entries 等）は `project_id` 経由で `auth_can_access_project` を使う。`organization_id` も必ず親と一致させる CHECK / トリガを置く。

## テーブル種別ごとの読み分け

| 種別 | SELECT | INSERT/UPDATE |
|------|--------|----------------|
| マスタ（materials, catalogs） | Org メンバー | `catalog.manage`（Office 以上） |
| 案件 Graph | 案件アクセス権 | 権限 + 案件アクセス |
| captures / photos | 案件アクセス | 現場ロールは自分のキャプチャを追加可 |
| capture_fields pending | 案件アクセス | 確定は `capture.confirm` |
| knowledge | `knowledge.read` | `knowledge.write` |
| signals | ロール別。Worker は自分の現場の注意事項のみ。経営シグナルは Manager 以上 | システム（trigger / service）が INSERT。ユーザーは feedback のみ |
| audit_logs | `audit.read`（Owner / Executive） | ユーザークライアントは INSERT 不可。トリガ / サーバ |
| import_jobs | `import.manage` | 同左 |
| organization_security_settings | Owner | Owner |

## 協力会社（Partner）

- 他社の顧客マスタ全件は見えない（担当案件の顧客名など必要最小）
- 原価・粗利・請負金額はデフォルト非表示（`finance.read` を Partner に付けない）
- 写真は担当案件のみ
- 知識ベースの全社横断は見せない（案件に自動表示された注意事項のコピーのみ可）

## 経営数値

`project_financials` は `finance.read` 必須。Worker の Today 画面は財務列を SELECT しない（RLS でも落とす）。

## Storage

バケット例: `org-files`

```
{organization_id}/projects/{project_id}/photos/{photo_id}
{organization_id}/projects/{project_id}/documents/{document_id}
{organization_id}/imports/{job_id}/...
```

ポリシー: パス先頭の `organization_id` が所属と一致し、かつ `auth_can_access_project`。インポートファイルは `import.manage`。

## 監査との関係

RLS を通る更新でも、重要操作は `audit_logs` に残す。

- 案件の金額変更
- キャプチャ確定 / 修正
- ロール変更
- インポート適用
- シグナルの採用 / 却下
- 論理削除

`audit_logs` 自体は改ざん防止のため UPDATE/DELETE ポリシーなし（または Owner でも不可。保持は運用）。

## 将来拡張（枠だけ）

`organization_security_settings`:

| 列 | 将来 |
|----|------|
| `sso_enabled` | SSO |
| `scim_enabled` | SCIM |
| `ip_allowlist` | IP制限 |
| `device_restriction_enabled` | 端末制限 |
| `mfa_required` | MFA |

MVP では列と「未使用なら制限しない」実装のみ。RLS は IP 制限を DB で encforce しきれないため、BFF / Auth Hook に拡張ポイントを置く。
