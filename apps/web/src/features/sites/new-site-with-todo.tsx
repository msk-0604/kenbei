"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SiteForm } from "@/features/sites/site-form";
import { ProgressChecklist } from "@/features/sites/progress-checklist";
import { HintBox } from "@/components/ui/hint-box";
import { Button } from "@/components/ui/button";
import type { ProgressPreset, ProjectProgressItem } from "@/features/sites/types";
import { normalizeMark } from "@/lib/site-rules";

type CreatedSite = { id: string; name: string };

async function fetchProgressItems(projectId: string): Promise<ProjectProgressItem[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("project_progress_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) {
    throw error;
  }
  return ((data ?? []) as ProjectProgressItem[]).map((item) => ({ ...item, mark: normalizeMark(item.mark, item.checked) }));
}

async function fetchCreatedSite(id: string): Promise<CreatedSite | null> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    name: (data.name as string) || "現場",
  };
}

function SiteTodoStep({
  site,
  organizationId,
  presets,
}: {
  site: CreatedSite;
  organizationId: string;
  presets: ProgressPreset[];
}) {
  const [items, setItems] = useState<ProjectProgressItem[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchProgressItems(site.id)
      .then((next) => {
        if (cancelled) return;
        setItems(next);
        setListKey((k) => k + 1);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : "工程の読み込みに失敗しました"
        );
        setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [site.id]);

  return (
    <div className="space-y-6">
      <HintBox>
        <p className="font-bold">
          「{site.name}」を登録しました。続けて作業工程を追加してください。
        </p>
        <p className="mt-2">
          下のリストからタップして追加するか、手入力で作成してください。作業者はあとから〇（完了）／△（途中）を押せます。
        </p>
      </HintBox>

      {loadError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-lg text-red-700">
          {loadError}
        </p>
      ) : null}

      {items === null ? (
        <p className="text-lg text-gray-600">工程を読み込んでいます…</p>
      ) : (
        <ProgressChecklist
          key={listKey}
          items={items}
          projectId={site.id}
          organizationId={organizationId}
          presets={presets}
          canManageItems
          showPercent={items.length > 0}
          notifyOnItemAdd={false}
        />
      )}

      <Link href={`/sites/${site.id}`} className="block">
        <Button fullWidth variant="secondary">
          完了して現場を見る
        </Button>
      </Link>
    </div>
  );
}

type FormProps = { organizationId: string; presets: ProgressPreset[] };

function NewSiteWithTodoFormInner({ organizationId, presets }: FormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const createdId = searchParams.get("created");
  const [created, setCreated] = useState<CreatedSite | null>(null);
  const [resumeError, setResumeError] = useState("");

  useEffect(() => {
    if (!createdId || created) return;
    let cancelled = false;
    void fetchCreatedSite(createdId).then((site) => {
      if (cancelled) return;
      if (!site) {
        setResumeError(
          "登録した現場を読み込めませんでした。もう一度登録してください。"
        );
        return;
      }
      setCreated(site);
    });
    return () => {
      cancelled = true;
    };
  }, [createdId, created]);

  function handleCreated(site: { id: string; name: string }) {
    setResumeError("");
    setCreated({ id: site.id, name: site.name });
    router.replace(`${pathname}?created=${site.id}`, { scroll: false });
    router.refresh();
  }

  const resuming = Boolean(createdId) && !created && !resumeError;

  if (resuming) {
    return <p className="text-lg text-gray-600">登録した現場を読み込んでいます…</p>;
  }

  if (created) {
    return <SiteTodoStep site={created} organizationId={organizationId} presets={presets} />;
  }

  return (
    <div className="space-y-6">
      <HintBox>
        現場情報を登録したあと、この画面のまま作業工程を作成できます。
      </HintBox>
      {resumeError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-lg text-red-700">
          {resumeError}
        </p>
      ) : null}
      <SiteForm onCreated={handleCreated} />
    </div>
  );
}

/** 現場登録 → 同一画面で作業工程作成 */
export function NewSiteWithTodoForm({ organizationId, presets }: FormProps) {
  return (
    <Suspense
      fallback={<p className="text-lg text-gray-600">画面を読み込んでいます…</p>}
    >
      <NewSiteWithTodoFormInner organizationId={organizationId} presets={presets} />
    </Suspense>
  );
}
