import postgres from "postgres";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const dbUrl = process.env.DB_URL || readEnvFile();

function readEnvFile() {
  try {
    const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
    const content = readFileSync(envPath, "utf8");
    const match = content.match(/^DB_URL=(.+)$/m);
    return match ? match[1].trim() : undefined;
  } catch {
    return undefined;
  }
}

if (!dbUrl) {
  console.error("DB_URL not found in env or .env file");
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: "require" });

await sql`
  create table if not exists funnel_events (
    id bigserial primary key,
    vid text not null,
    event_name text not null,
    page text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,
    fbclid text,
    gclid text,
    meta jsonb,
    raw_params jsonb,
    lead jsonb,
    sid text,
    created_at timestamptz not null default now()
  )
`;

await sql`alter table funnel_events add column if not exists raw_params jsonb`;
await sql`alter table funnel_events add column if not exists lead jsonb`;
await sql`alter table funnel_events add column if not exists sid text`;

await sql`create index if not exists funnel_events_vid_idx on funnel_events (vid)`;
await sql`create index if not exists funnel_events_name_idx on funnel_events (event_name)`;
await sql`create index if not exists funnel_events_created_idx on funnel_events (created_at)`;
await sql`create index if not exists funnel_events_sid_idx on funnel_events (sid)`;

console.log("funnel_events table ready");
await sql.end();
