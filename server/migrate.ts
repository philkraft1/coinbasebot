import { migrateStore, openAuthStore } from "./lib/store.ts";

const store = await openAuthStore({
  url: process.env.AUTH_DATABASE_URL_OWNER || process.env.AUTH_DATABASE_URL,
});
const result = await migrateStore(store, process.env.AUTH_DATABASE_URL_OWNER || "");
await store.close();
console.log(`Auth schema applied (${store.kind}${result.roleCreated ? ", created auth_app" : ""}).`);
