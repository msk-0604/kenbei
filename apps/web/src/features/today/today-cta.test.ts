import { describe, expect, it } from "vitest";
import { todayPhotoHref, todayTaskHref, TODAY_PHOTO_LABEL, TODAY_REPORT_LABEL, TODAY_TASK_LABEL } from "./today-cta";

describe("Today core CTAs", () => {
  it("keeps photo / work / report labels explicit", () => {
    expect(TODAY_PHOTO_LABEL).toBe("写真を追加");
    expect(TODAY_TASK_LABEL).toBe("今日の作業を追加");
    expect(TODAY_REPORT_LABEL).toBe("今日の日報を作る");
  });

  it("points photo CTA at upload with the current site", () => {
    expect(todayPhotoHref("abc")).toBe("/photos/upload?projectId=abc");
    expect(todayPhotoHref(null)).toBe("/photos/upload");
  });

  it("keeps work CTA on Today instead of photos", () => {
    expect(todayTaskHref()).toBe("#today-add-task");
  });
});
