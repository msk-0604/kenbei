import { describe, expect, it } from "vitest";
import { HELP_SECTIONS } from "./help-content";
import { setupProgress, setupSteps } from "./setup-checklist";

const empty = { workerCount: 0, workerPasscodeSet: false, siteCount: 0, scheduleCount: 0, workStarted: false };

describe("setupSteps", () => {
  it("starts with nothing done and points to the import page", () => {
    const steps = setupSteps(empty);
    expect(setupProgress(steps)).toEqual({ done: 0, total: 5, complete: false });
    expect(steps[0]?.href).toBe("/workers/new");
  });

  it("marks steps done as the company sets up", () => {
    const steps = setupSteps({ ...empty, workerCount: 3, siteCount: 1 });
    expect(steps.filter((step) => step.done).map((step) => step.key)).toEqual(["workers", "sites"]);
    expect(steps[0]?.href).toBe("/workers");
  });

  it("is complete once workers start work from their phones", () => {
    const steps = setupSteps({ workerCount: 3, workerPasscodeSet: true, siteCount: 1, scheduleCount: 4, workStarted: true });
    expect(setupProgress(steps).complete).toBe(true);
  });
});

describe("help content", () => {
  it("has unique section ids and question text", () => {
    const ids = HELP_SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    const questions = HELP_SECTIONS.flatMap((section) => section.items.map((item) => item.q));
    expect(new Set(questions).size).toBe(questions.length);
  });

  it("states the current price", () => {
    const text = JSON.stringify(HELP_SECTIONS);
    expect(text).toContain("月額18,000円（税込）");
    expect(text).not.toContain("9,800");
  });
});
