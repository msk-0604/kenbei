import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { persistableBillingPlanCode } from "@kensapo/domain";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function verifyStripeSignature(raw: string, header: string | null, secret: string): boolean {
  if (!header) {
    return false;
  }
  const timestamp = header
    .split(",")
    .find((item) => item.startsWith("t="))
    ?.slice(2);
  const signatures = header
    .split(",")
    .filter((item) => item.startsWith("v1="))
    .map((item) => item.slice(3));
  if (!timestamp || signatures.length === 0) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  return signatures.some((signature) => {
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(signature, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await request.text();
  if (!secret || !verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(raw) as {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  };
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return NextResponse.json({ error: "service role not configured" }, { status: 503 });
  }
  const seen = await admin.from("stripe_webhook_events").select("event_id").eq("event_id", event.id).maybeSingle();
  if (seen.data) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  const obj = event.data.object;
  const meta = obj.metadata as { organization_id?: string; plan_code?: string } | undefined;
  const organizationId = meta?.organization_id || (obj.client_reference_id as string | undefined) || null;
  const planCode = meta?.plan_code ? persistableBillingPlanCode(meta.plan_code) : null;

  if (event.type === "checkout.session.completed") {
    const customer = obj.customer as string | undefined;
    const subscription = obj.subscription as string | undefined;
    if (organizationId) {
      await admin.from("organization_billing").upsert({
        organization_id: organizationId,
        stripe_customer_id: customer ?? null,
        stripe_subscription_id: subscription ?? null,
        status: "active",
        ...(planCode ? { plan_code: planCode } : {}),
      });
    }
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const status = obj.status as string | undefined;
    const org =
      organizationId ||
      (
        await admin
          .from("organization_billing")
          .select("organization_id")
          .eq("stripe_subscription_id", obj.id as string)
          .maybeSingle()
      ).data as { organization_id: string } | null;
    const orgId = typeof org === "string" ? org : org?.organization_id;
    if (orgId) {
      const mapped =
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : status === "past_due" || status === "unpaid" || status === "active" || status === "trialing"
            ? status
            : "active";
      const patch: {
        status: string;
        cancel_at_period_end: boolean;
        current_period_end: string | null;
        plan_code?: string;
      } = {
        status: mapped,
        cancel_at_period_end: Boolean(obj.cancel_at_period_end),
        current_period_end: obj.current_period_end
          ? new Date(Number(obj.current_period_end) * 1000).toISOString()
          : null,
      };
      if (mapped === "canceled") {
        patch.plan_code = "free";
      } else if (planCode) {
        patch.plan_code = planCode;
      }
      await admin.from("organization_billing").update(patch).eq("organization_id", orgId);
    }
  }
  if (event.type === "invoice.payment_failed") {
    const sub = obj.subscription as string | undefined;
    if (sub) {
      await admin.from("organization_billing").update({ status: "past_due" }).eq("stripe_subscription_id", sub);
    }
  }
  await admin.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    organization_id: organizationId,
  });
  return NextResponse.json({ ok: true });
}
