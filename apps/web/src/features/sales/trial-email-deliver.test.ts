import { describe, expect, it } from "vitest";
import { deliverTrialLifecycleEmail } from "./trial-email-deliver";
import { createMemoryTrialEmailAdmin } from "./trial-email-memory";
import { TRIAL_EMAIL_KINDS } from "./trial-email-schedule";
import { TRIAL_EMAIL_MAX_ATTEMPTS } from "./trial-email-retry";

const appUrl = "https://app.kenbei.jp";
const orgId = "11111111-1111-4111-8111-111111111111";
const to = "owner@test.kenbei.example";

describe("trial email delivery", () => {
  it("does not send when the production flag is off", async () => {
    const admin = createMemoryTrialEmailAdmin();
    const sent: string[] = [];
    const result = await deliverTrialLifecycleEmail({
      admin,
      organizationId: orgId,
      kind: "trial_started",
      recipientEmail: to,
      enabled: false,
      appUrl,
      sendMail: async () => {
        sent.push("no");
        return { ok: true };
      },
    });
    expect(result).toBe("disabled");
    expect(sent).toEqual([]);
    expect(admin.rows.size).toBe(0);
  });

  it("sends each Japanese lifecycle mail once and records history", async () => {
    const admin = createMemoryTrialEmailAdmin();
    const inbox: { subject: string; text: string; to: string }[] = [];
    for (const kind of TRIAL_EMAIL_KINDS) {
      const result = await deliverTrialLifecycleEmail({
        admin,
        organizationId: orgId,
        kind,
        recipientEmail: to,
        enabled: true,
        appUrl,
        sendMail: async (mail) => {
          inbox.push({ subject: mail.subject, text: mail.text, to: mail.to });
          return { ok: true };
        },
      });
      expect(result).toBe("sent");
      const again = await deliverTrialLifecycleEmail({
        admin,
        organizationId: orgId,
        kind,
        recipientEmail: to,
        enabled: true,
        appUrl,
        sendMail: async () => ({ ok: true }),
      });
      expect(again).toBe("skipped");
    }
    expect(inbox).toHaveLength(3);
    expect(inbox.map((item) => item.to)).toEqual([to, to, to]);
    expect(inbox[0]?.subject).toBe("KENBEIの14日間無料体験が始まりました");
    expect(inbox[0]?.text).toMatch(/現場ごとの写真/);
    expect(inbox[0]?.text).toMatch(/日報PDF/);
    expect(inbox[0]?.text).toMatch(/AI軍師/);
    expect(inbox[0]?.text).toMatch(/39,800円（税込/);
    expect(inbox[1]?.subject).toMatch(/現場写真と残作業/);
    expect(inbox[1]?.text).toMatch(/開始から3日/);
    expect(inbox[2]?.subject).toMatch(/終了が近づいています/);
    expect(inbox[2]?.text).toMatch(/あと2日/);
    expect(admin.rows.size).toBe(3);
    for (const row of admin.rows.values()) {
      expect(row.status).toBe("sent");
      expect(row.attempt_count).toBe(1);
    }
  });

  it("retries a failed send and then stops after the max attempts", async () => {
    const admin = createMemoryTrialEmailAdmin();
    let calls = 0;
    const fail = async () => {
      calls += 1;
      return { ok: false as const, error: "resend 500" };
    };
    const first = await deliverTrialLifecycleEmail({
      admin,
      organizationId: orgId,
      kind: "trial_day3",
      recipientEmail: to,
      now: new Date("2026-10-04T00:00:00.000Z"),
      enabled: true,
      appUrl,
      sendMail: fail,
    });
    expect(first).toBe("failed");
    const stored = admin.rows.get(`${orgId}:trial_day3`);
    expect(stored?.status).toBe("failed");
    expect(stored?.attempt_count).toBe(1);
    expect(stored?.next_retry_at).toBe("2026-10-04T00:15:00.000Z");

    const tooSoon = await deliverTrialLifecycleEmail({
      admin,
      organizationId: orgId,
      kind: "trial_day3",
      recipientEmail: to,
      now: new Date("2026-10-04T00:05:00.000Z"),
      enabled: true,
      appUrl,
      sendMail: fail,
    });
    expect(tooSoon).toBe("skipped");
    expect(calls).toBe(1);

    const retried = await deliverTrialLifecycleEmail({
      admin,
      organizationId: orgId,
      kind: "trial_day3",
      recipientEmail: to,
      now: new Date("2026-10-04T00:15:00.000Z"),
      enabled: true,
      appUrl,
      sendMail: async () => ({ ok: true }),
    });
    expect(retried).toBe("sent");
    expect(admin.rows.get(`${orgId}:trial_day3`)?.status).toBe("sent");

    const exhaustedAdmin = createMemoryTrialEmailAdmin();
    for (let attempt = 0; attempt < TRIAL_EMAIL_MAX_ATTEMPTS; attempt += 1) {
      const result = await deliverTrialLifecycleEmail({
        admin: exhaustedAdmin,
        organizationId: orgId,
        kind: "trial_ending_soon",
        recipientEmail: to,
        now: new Date(Date.UTC(2026, 9, 13 + attempt * 2)),
        enabled: true,
        appUrl,
        sendMail: fail,
      });
      expect(result).toBe("failed");
    }
    const stopped = await deliverTrialLifecycleEmail({
      admin: exhaustedAdmin,
      organizationId: orgId,
      kind: "trial_ending_soon",
      recipientEmail: to,
      now: new Date("2026-12-01T00:00:00.000Z"),
      enabled: true,
      appUrl,
      sendMail: fail,
    });
    expect(stopped).toBe("skipped");
    expect(exhaustedAdmin.rows.get(`${orgId}:trial_ending_soon`)?.attempt_count).toBe(TRIAL_EMAIL_MAX_ATTEMPTS);
  });
});
