import { getDb } from "./db";

export type ApplicationStatus = "identified" | "applied" | "interviewing" | "offered" | "rejected" | "accepted" | "withdrawn";

export interface Application {
  id: number;
  user_id: number;
  company: string;
  role: string;
  status: ApplicationStatus;
  job_posting_text: string | null;
  cv_path: string | null;
  cover_letter_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function getApplications(userId: number): Application[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM applications WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId) as Application[];
}

export function getApplication(userId: number, id: number): Application | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?")
    .get(id, userId) as Application | undefined;
}

export function createApplication(
  userId: number,
  data: { company: string; role: string; status?: ApplicationStatus; job_posting_text?: string; notes?: string }
): number {
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO applications (user_id, company, role, status, job_posting_text, notes) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(userId, data.company, data.role, data.status || "identified", data.job_posting_text || null, data.notes || null);
  return result.lastInsertRowid as number;
}

const ALLOWED_UPDATE_FIELDS = new Set(["company", "role", "status", "job_posting_text", "cv_path", "cover_letter_path", "notes"]);

export function updateApplication(
  userId: number,
  id: number,
  data: Partial<Pick<Application, "company" | "role" | "status" | "job_posting_text" | "cv_path" | "cover_letter_path" | "notes">>
): boolean {
  const db = getDb();
  const fields: string[] = [];
  const values: (string | null | number)[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && ALLOWED_UPDATE_FIELDS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return false;

  fields.push("updated_at = datetime('now')");
  values.push(id, userId);

  const result = db
    .prepare(`UPDATE applications SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`)
    .run(...values);

  return result.changes > 0;
}

export function deleteApplication(userId: number, id: number): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM applications WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return result.changes > 0;
}

export function deleteUserApplications(userId: number): void {
  const db = getDb();
  db.prepare("DELETE FROM applications WHERE user_id = ?").run(userId);
}

export function formatApplicationsForPrompt(userId: number): string {
  const apps = getApplications(userId);
  if (apps.length === 0) return "";

  const lines = apps.map(
    (a) => `- ${a.company} — ${a.role} [${a.status}]${a.notes ? ` (${a.notes})` : ""}`
  );

  return `# Tracked Applications\n\n${lines.join("\n")}`;
}
