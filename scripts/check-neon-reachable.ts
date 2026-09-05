import { closeDb, getDb, isDatabaseConfigured } from "../src/lib/db/client";
import { getContentStoreMode } from "../src/lib/content/store-config";
import { sql } from "drizzle-orm";

function mask(value: unknown): string {
  return String(value).replace(/postgresql:\/\/[^@]+@/g, "postgresql://***@");
}

async function main() {
  console.log(`CONTENT_STORE=${getContentStoreMode()}`);
  console.log(`DATABASE_URL present: ${isDatabaseConfigured()}`);
  if (getContentStoreMode() !== "database" || !isDatabaseConfigured()) {
    process.exit(1);
  }
  const db = await getDb();
  const ping = await db.execute(sql`select 1 as ok`);
  console.log("NEON DATABASE REACHABLE: PASS", JSON.stringify(ping));
  const tables = await db.execute(
    sql`select table_schema, table_name from information_schema.tables where table_name in ('articles','products','__drizzle_migrations') order by table_schema, table_name`,
  );
  console.log("tables:", JSON.stringify(tables));
  try {
    const migrations = await db.execute(
      sql`select id, hash, created_at from drizzle.__drizzle_migrations order by created_at`,
    );
    console.log("drizzle migrations:", JSON.stringify(migrations));
  } catch (error) {
    console.log("drizzle migrations table:", mask(error));
  }
  await closeDb();
}

main().catch((error) => {
  console.error("NEON DATABASE REACHABLE: FAIL");
  console.error(mask(error));
  process.exit(1);
});
