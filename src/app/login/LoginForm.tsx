"use client";

import { useActionState } from "react";
import { SignInIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <label htmlFor="username" className="flex flex-col gap-1.5">
        <span className="text-[14px] font-medium text-ink-2">Username</span>
        <input id="username" name="username" autoComplete="username" defaultValue={state.username ?? ""} required
          className="h-12 rounded-[12px] border border-line-strong bg-surface px-4 text-[15px] outline-none focus:border-ink" />
      </label>
      <label htmlFor="password" className="flex flex-col gap-1.5">
        <span className="text-[14px] font-medium text-ink-2">Password</span>
        <input id="password" name="password" type="password" autoComplete="current-password" required
          className="h-12 rounded-[12px] border border-line-strong bg-surface px-4 text-[15px] outline-none focus:border-ink" />
      </label>
      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-[12px] bg-bad-soft px-3.5 py-3 text-[14px] text-bad">
          <WarningCircleIcon size={18} weight="fill" className="mt-px shrink-0" />
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending}
        className="press mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-night text-[15px] font-medium text-[#fff8f5] disabled:opacity-60">
        <SignInIcon size={18} />
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
