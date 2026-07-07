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

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
  const tableNames = tables.map((t) => t.name);
  if (!tableNames.includes("profiles")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        section TEXT NOT NULL CHECK (section IN ('identity', 'education', 'experience', 'skills', 'behavioral', 'preferences')),
        content TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, section)
      )
    `);
  }
  if (!tableNames.includes("applications")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'applied', 'interviewing', 'offered', 'rejected', 'accepted', 'withdrawn')),
        job_posting_text TEXT,
        cv_path TEXT,
        cover_letter_path TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  return db;
}
