import { resolvedCaptureValue, type CaptureFieldRecord } from "@kensapo/domain";
import { describe, expect, it } from "vitest";
import { planConfirmedCaptureWrites } from "./plan";

function field(
  fieldKey: string,
  proposedValue: CaptureFieldRecord["proposedValue"],
  status: CaptureFieldRecord["status"],
  confirmedValue: CaptureFieldRecord["confirmedValue"] = null,
): CaptureFieldRecord {
  return {
    fieldKey,
    confidence: 0.9,
    proposedValue,
    correctedValue: null,
    confirmedValue,
    status,
    confirmedBy: status === "pending" ? null : "user",
    confirmedAt: status === "pending" ? null : "2026-08-17T00:00:00Z",
  };
}

describe("graph apply planner", () => {
  it("ignores pending AI proposals", () => {
    const writes = planConfirmedCaptureWrites({
      organizationId: "org",
      projectId: "p",
      captureId: "c",
      occurredOn: "2026-08-17",
      createdBy: "u",
      fields: [
        field("material", "HI25", "pending"),
        field("quantity", 12, "confirmed", 12),
      ],
    });
    expect(writes.some((write) => write.kind === "material_usage")).toBe(false);
  });

  it("writes confirmed material and work event", () => {
    const writes = planConfirmedCaptureWrites({
      organizationId: "org",
      projectId: "p",
      captureId: "c",
      occurredOn: "2026-08-17",
      createdBy: "u",
      fields: [
        field("work_type", "給排水", "confirmed", "給排水"),
        field("material", "HI25", "corrected", "HI25"),
        field("quantity", 12, "confirmed", 12),
        field("unit", "本", "auto_accepted"),
      ],
    });
    expect(resolvedCaptureValue(field("unit", "本", "auto_accepted"))).toBe("本");
    expect(writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "work_event", workTypeKey: "給排水" }),
        expect.objectContaining({ kind: "material_usage", materialCode: "HI25", quantity: 12, unit: "本" }),
      ]),
    );
  });
});
