"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {/* Honeypot: fuera de pantalla y fuera del orden de tabulación. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label htmlFor="website">No completar</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="min-h-11 rounded border border-gray-500 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-11 rounded border border-gray-500 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-red-800">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded bg-blue-800 px-4 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-70"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
