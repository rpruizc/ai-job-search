import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    if (schema.trim()) {
      db.exec(schema);
    }
  }

  const columns = db.pragma("table_info(messages)") as { name: string }[];
  const colNames = columns.map((c) => c.name);
  if (!colNames.includes("input_tokens")) {
    db.exec("ALTER TABLE messages ADD COLUMN input_tokens INTEGER");
  }
  if (!colNames.includes("output_tokens")) {
    db.exec("ALTER TABLE messages ADD COLUMN output_tokens INTEGER");
  }

  return db;
}
