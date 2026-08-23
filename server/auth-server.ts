import { buildApp } from "./app.ts";

const port = Number(process.env.AUTH_PORT || 43148);
const host = process.env.AUTH_HOST || "127.0.0.1";

const { app } = await buildApp();
await app.listen({ host, port });
const storeKind = (await app.inject({ method: "GET", url: "/api/health" })).json().store;
console.log(`Auth API listening on http://${host}:${port} (store=${storeKind})`);
