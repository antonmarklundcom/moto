// Alta de un usuario del panel (ADMIN_SPEC.md §1: sin registro público).
//
//   npm run create-admin -- --email vos@ejemplo.com --name "Tu Nombre" [--role moderator] [--reset]
//
// La contraseña NUNCA va en los argumentos (quedaría en el historial y en `ps`):
// se pide sin eco si hay terminal, o se lee de stdin (primera línea):
//   printf '%s\n' "$CLAVE" | npm run create-admin -- --email …
// Con --reset también borra los intentos fallidos de esa cuenta (desbloqueo).
//
// tsx no carga .env solo (CLAUDE.md §2): dotenv va primero, antes de que
// src/db lea DATABASE_URL.
import "dotenv/config";

import { parseArgs } from "node:util";
import { closeDb } from "../src/db";
import { clearAccountFailures } from "../src/lib/auth/lockout";
import { passwordProblem } from "../src/lib/auth/password";
import { createPanelUser } from "../src/lib/auth/users";

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          reject(new Error("Cancelado."));
          return;
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function readStdinLine(): Promise<string> {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data.split(/\r?\n/)[0] ?? "";
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      role: { type: "string", default: "admin" },
      reset: { type: "boolean", default: false },
      password: { type: "string" },
    },
    strict: true,
  });

  if (values.password !== undefined) {
    throw new Error("La contraseña no se pasa por argumento. Se pide sin eco o se lee de stdin.");
  }
  if (!values.email || !values.name) {
    throw new Error('Uso: npm run create-admin -- --email vos@ejemplo.com --name "Tu Nombre" [--role moderator] [--reset]');
  }
  if (values.role !== "admin" && values.role !== "moderator") {
    throw new Error("--role tiene que ser admin o moderator. Los usuarios de comercio se crean desde Comercios.");
  }

  let password: string;
  if (process.stdin.isTTY) {
    password = await readHidden("Contraseña: ");
    const again = await readHidden("Repetila: ");
    if (password !== again) throw new Error("Las contraseñas no coinciden.");
  } else {
    password = await readStdinLine();
  }
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);

  const result = await createPanelUser({
    email: values.email,
    name: values.name,
    password,
    role: values.role,
    resetIfExists: values.reset,
  });
  // Resetear también desbloquea la cuenta (los fallos por IP siguen contando).
  const salt = process.env.IP_HASH_SALT?.trim();
  if (!result.created && salt) await clearAccountFailures(values.email, salt);

  console.log(
    result.created
      ? `Usuario ${values.role} creado (id ${result.id}).`
      : `Contraseña actualizada y usuario reactivado (id ${result.id}).`,
  );
}

main()
  .then(() => closeDb())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await closeDb();
    process.exit(1);
  });
