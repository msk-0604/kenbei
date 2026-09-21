import { describe, expect, it } from "vitest";
import {
  todayPhotoHref,
  todayReportHref,
  todayTaskHref,
  TODAY_PHOTO_LABEL,
  TODAY_REPORT_DONE_LABEL,
  TODAY_REPORT_LABEL,
  TODAY_REPORT_REVIEW_LABEL,
  TODAY_TASK_LABEL,
} from "./today-cta";

describe("Today core CTAs", () => {
  it("keeps photo / work / report labels explicit", () => {
    expect(TODAY_PHOTO_LABEL).toBe("写真を追加");
    expect(TODAY_TASK_LABEL).toBe("今日の作業を追加");
    expect(TODAY_REPORT_LABEL).toBe("今日の日報を作る");
    expect(TODAY_REPORT_REVIEW_LABEL).toBe("今日の日報を確認");
    expect(TODAY_REPORT_DONE_LABEL).toBe("今日の日報を見る");
  });

  it("points photo CTA at upload with the current site", () => {
    expect(todayPhotoHref("abc")).toBe("/photos/upload?projectId=abc");
    expect(todayPhotoHref(null)).toBe("/photos/upload");
  });

  it("keeps work CTA on Today instead of photos", () => {
    expect(todayTaskHref()).toBe("#today-add-task");
  });

  it("opens an existing daily report instead of creating another", () => {
    expect(todayReportHref("rep-1")).toBe("/reports/rep-1");
  });
});
