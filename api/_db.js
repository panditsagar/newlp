import postgres from "postgres";

let sql;

export function getDb() {
  if (!sql) {
    sql = postgres(process.env.DB_URL, { ssl: "require", max: 3, idle_timeout: 20 });
  }
  return sql;
}
