import type { EmailAdmin } from "./trial-email-deliver";

export type TrialEmailRow = {
  organization_id: string;
  kind: string;
  recipient_email: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  next_retry_at: string | null;
  sent_at: string | null;
};

export function createMemoryTrialEmailAdmin(): EmailAdmin & { rows: Map<string, TrialEmailRow> } {
  const rows = new Map<string, TrialEmailRow>();
  const keyOf = (organizationId: string, kind: string) => `${organizationId}:${kind}`;

  return {
    rows,
    from() {
      const filters: { column: string; value: string }[] = [];
      let patch: Record<string, unknown> | null = null;
      const api = {
        select() {
          return api;
        },
        eq(column: string, value: string) {
          filters.push({ column, value });
          return api;
        },
        async maybeSingle() {
          const organizationId = filters.find((item) => item.column === "organization_id")?.value;
          const kind = filters.find((item) => item.column === "kind")?.value;
          if (!organizationId || !kind) {
            return { data: null, error: null };
          }
          return { data: rows.get(keyOf(organizationId, kind)) ?? null, error: null };
        },
        async insert(row: Record<string, unknown>) {
          const key = keyOf(String(row.organization_id), String(row.kind));
          if (rows.has(key)) {
            return { error: { code: "23505", message: "duplicate key value violates unique constraint trial_lifecycle_emails_pkey" } };
          }
          rows.set(key, {
            organization_id: String(row.organization_id),
            kind: String(row.kind),
            recipient_email: String(row.recipient_email),
            status: String(row.status),
            attempt_count: Number(row.attempt_count ?? 0),
            last_error: (row.last_error as string | null) ?? null,
            next_retry_at: (row.next_retry_at as string | null) ?? null,
            sent_at: (row.sent_at as string | null) ?? null,
          });
          return { error: null };
        },
        update(row: Record<string, unknown>) {
          patch = row;
          return api;
        },
        then(resolve: (value: { error: null }) => void) {
          const organizationId = filters.find((item) => item.column === "organization_id")?.value;
          const kind = filters.find((item) => item.column === "kind")?.value;
          if (organizationId && kind && patch) {
            const key = keyOf(organizationId, kind);
            const current = rows.get(key);
            if (current) {
              rows.set(key, {
                ...current,
                ...patch,
                attempt_count: Number(patch.attempt_count ?? current.attempt_count),
                last_error: (patch.last_error as string | null | undefined) ?? current.last_error,
                next_retry_at: (patch.next_retry_at as string | null | undefined) ?? null,
                sent_at: (patch.sent_at as string | null | undefined) ?? current.sent_at,
                status: String(patch.status ?? current.status),
                recipient_email: String(patch.recipient_email ?? current.recipient_email),
              });
            }
          }
          resolve({ error: null });
        },
      };
      return api;
    },
  };
}
