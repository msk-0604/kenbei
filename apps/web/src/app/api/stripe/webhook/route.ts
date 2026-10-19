import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  applyStripeWebhookBusiness,
  claimStripeWebhookEventInDb,
  organizationIdFromStripeObject,
  type StripeWebhookEvent,
} from "@/features/billing/stripe-webhook";
import { verifyStripeSignature } from "@/features/billing/stripe-signature";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await request.text();
  if (!secret || !verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(raw) as StripeWebhookEvent;
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return NextResponse.json({ error: "service role not configured" }, { status: 503 });
  }
  const organizationId = organizationIdFromStripeObject(event.data.object);
  const db = admin as unknown as Parameters<typeof claimStripeWebhookEventInDb>[0];
  const claim = await claimStripeWebhookEventInDb(db, event, organizationId);
  if (claim === "duplicate") {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  if (claim === "error") {
    return NextResponse.json({ error: "could not claim event" }, { status: 503 });
  }
  try {
    await applyStripeWebhookBusiness(db, event, organizationId);
  } catch {
    await admin.from("stripe_webhook_events").delete().eq("event_id", event.id);
    return NextResponse.json({ error: "webhook processing failed" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
