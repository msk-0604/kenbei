import { signOutAction } from "@/features/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 text-base font-medium"
      >
        サインアウト
      </button>
    </form>
  );
}
