import { redirect } from "next/navigation";
import { safeAuthNextPath } from "@kensapo/domain";
import { PasskeyOffer } from "@/features/auth/passkey-offer";
import { getWorkspace } from "@/lib/session";
import { isCrewLogin } from "@/lib/authz-guard";

export const dynamic = "force-dynamic";

export default async function PasskeyOfferPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const nextPath = safeAuthNextPath((await searchParams).next) || "/";
  const workspace = await getWorkspace();
  if (!workspace || isCrewLogin(workspace)) {
    redirect(nextPath);
  }
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <PasskeyOffer nextPath={nextPath} />
    </div>
  );
}
