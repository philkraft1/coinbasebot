import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "./app.ts";

type Built = Awaited<ReturnType<typeof buildApp>>;

let cached: Promise<Built> | undefined;

async function getBuilt(): Promise<Built> {
  if (!cached) cached = buildApp();
  return cached;
}

/** Vercel Node handler — reuse one Fastify instance across warm invocations. */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const { app } = await getBuilt();
  await app.ready();
  app.server.emit("request", req, res);
}
