import { describe, expect, it } from "vitest";
import {
  todayPhotoHref,
  todayReportHref,
  todayTaskHref,
  todaySteps,
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

describe("todaySteps", () => {
  it("starts with photos on a fresh day", () => {
    const result = todaySteps({ photoCount: 0, openFocusTaskCount: 2, reportStatus: "none" });
    expect(result.next).toBe("photo");
    expect(result.steps.map((step) => step.status)).toEqual(["まだ0枚", "残り 2件", "まだ"]);
  });

  it("moves to tasks, then the report, then finishes", () => {
    expect(todaySteps({ photoCount: 3, openFocusTaskCount: 1, reportStatus: "none" }).next).toBe("task");
    expect(todaySteps({ photoCount: 3, openFocusTaskCount: 0, reportStatus: "draft" }).next).toBe("report");
    expect(todaySteps({ photoCount: 3, openFocusTaskCount: 0, reportStatus: "confirmed" }).next).toBeNull();
  });
});
