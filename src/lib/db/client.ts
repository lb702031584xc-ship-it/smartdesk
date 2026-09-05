import { lookup } from "node:dns/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let initPromise: Promise<ReturnType<typeof drizzle<typeof schema>>> | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

async function createPostgresClient(url: string) {
  const parsed = new URL(url);
  const lookupResult = await lookup(parsed.hostname, { family: 4 });
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const ssl =
    parsed.searchParams.get("sslmode") === "disable"
      ? false
      : { rejectUnauthorized: true, servername: parsed.hostname };

  const options = {
    host: lookupResult.address,
    port: Number(parsed.port || 5432),
    database: database || "neondb",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl,
    max: 10,
    connect_timeout: Number(parsed.searchParams.get("connect_timeout") || 30),
  } as const;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const nextClient = postgres(options);
    try {
      await nextClient`select 1`;
      return nextClient;
    } catch (error) {
      lastError = error;
      await nextClient.end({ timeout: 1 }).catch(() => undefined);
    }
  }

  throw lastError;
}

export async function getDb() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "[db] DATABASE_URL is not configured. Set CONTENT_STORE=filesystem or provide DATABASE_URL.",
    );
  }

  if (dbInstance) {
    return dbInstance;
  }

  if (!initPromise) {
    initPromise = (async () => {
      client = await createPostgresClient(url);
      dbInstance = drizzle(client, { schema });
      return dbInstance;
    })();
  }

  return initPromise;
}

export async function closeDb() {
  initPromise = null;
  if (client) {
    await client.end();
    client = null;
    dbInstance = null;
  }
}
