const send = process.argv.includes("--send");
const toArg = process.argv.find((item) => item.startsWith("--to="))?.slice(5) ?? "";

console.log("Trial email bodies and timing are covered by apps/web/src/features/sales/* tests.");
console.log("Production KENBEI_TRIAL_EMAILS_ENABLED is not used by this script.");
if (!send) {
  console.log("No email was sent.");
  console.log("Real local send requires an approved inbox first, then:");
  console.log("  KENBEI_TRIAL_EMAILS_TEST=1");
  console.log("  KENBEI_TRIAL_EMAILS_TEST_TO=<approved address>");
  console.log("  node scripts/preview-trial-emails.mjs --send --to=<approved address>");
  process.exit(0);
}
if (!toArg) {
  console.error("Missing --to. Confirm the approved test inbox before any real send.");
  process.exit(1);
}
console.error("Refused real send until the approved inbox is confirmed in chat. Production flag stays off.");
process.exit(1);
