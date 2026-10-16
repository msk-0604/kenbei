"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { EQUIPMENT_OPTIONS, PLACE_OPTIONS, WORK_OPTIONS } from "@/lib/standard-progress-items";

type NewItem = {
  category: string;
  section: string | null;
  item_name: string;
};

function ComboField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const suggestions = options.filter((option) => option.includes(value));

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        ref.current &&
        e.target instanceof Node &&
        !ref.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <label className="text-lg font-bold text-gray-900">
      {label}
      <div className="relative mt-1" ref={ref}>
        <input
          className="min-h-14 w-full rounded-2xl border-2 border-gray-300 px-3 pr-12 text-lg"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="候補から選ぶか、自由に入力してください"
          autoComplete="off"
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        {open && suggestions.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border-2 border-gray-300 bg-white shadow-lg">
            {suggestions.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className="flex min-h-14 w-full items-center px-4 text-left text-lg font-bold text-gray-950 active:bg-gray-100"
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </label>
  );
}

export function ProcessPlanner({
  onAdd,
}: {
  onAdd: (item: NewItem) => Promise<void> | void;
}) {
  const [place, setPlace] = useState("");
  const [equipment, setEquipment] = useState("");
  const [work, setWork] = useState("");
  const [suffix, setSuffix] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(item: NewItem) {
    const name = item.item_name.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    try {
      await onAdd({ ...item, item_name: name });
    } finally {
      setSubmitting(false);
    }
  }

  function compose() {
    const placeValue = place.trim();
    const equipmentValue = equipment.trim();
    const workValue = work.trim();
    if (!placeValue) return;

    const mark = suffix.trim();
    const equipmentName = mark ? `${equipmentValue}${mark}` : equipmentValue;

    if (placeValue === "屋外") {
      if (!equipmentValue) return;
      void submit({ category: "屋外", section: null, item_name: equipmentName });
      return;
    }
    if (placeValue === "水圧テスト" || placeValue === "申請書類") {
      if (!equipmentValue || !workValue) return;
      void submit({ category: placeValue, section: equipmentValue, item_name: workValue });
      return;
    }
    if (!equipmentValue || !workValue) return;
    void submit({
      category: "屋内",
      section: placeValue,
      item_name: `${equipmentName}・${workValue}`,
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border-2 border-gray-200 bg-white p-4">
      <h2 className="text-xl font-bold text-gray-950">工程を作る</h2>
      <div className="grid gap-3">
        <ComboField label="場所" value={place} onChange={setPlace} options={PLACE_OPTIONS} />
        <ComboField
          label="設備"
          value={equipment}
          onChange={setEquipment}
          options={EQUIPMENT_OPTIONS}
        />
        <ComboField label="作業" value={work} onChange={setWork} options={WORK_OPTIONS} />
        <label className="text-lg font-bold text-gray-900">
          区別（任意）
          <input
            className="mt-1 min-h-14 w-full rounded-2xl border-2 border-gray-300 px-3 text-lg"
            value={suffix}
            onChange={(event) => setSuffix(event.target.value)}
            placeholder="例：①"
          />
        </label>
        <button
          type="button"
          disabled={submitting}
          className="min-h-14 rounded-2xl border-2 border-gray-900 text-lg font-bold disabled:opacity-50"
          onClick={compose}
        >
          {submitting ? "追加中…" : "追加"}
        </button>
      </div>
    </section>
  );
}
