import { getDb } from "./db";

export type ProfileSection = "identity" | "education" | "experience" | "skills" | "behavioral" | "preferences";

export const PROFILE_SECTIONS: ProfileSection[] = [
  "identity",
  "education",
  "experience",
  "skills",
  "behavioral",
  "preferences",
];

export interface ProfileRow {
  id: number;
  user_id: number;
  section: ProfileSection;
  content: string;
  updated_at: string;
}

export function getProfile(userId: number): Record<ProfileSection, string> {
  const db = getDb();
  const rows = db
    .prepare("SELECT section, content FROM profiles WHERE user_id = ?")
    .all(userId) as { section: ProfileSection; content: string }[];

  const profile: Record<ProfileSection, string> = {
    identity: "{}",
    education: "{}",
    experience: "{}",
    skills: "{}",
    behavioral: "{}",
    preferences: "{}",
  };

  for (const row of rows) {
    profile[row.section] = row.content;
  }

  return profile;
}

export function getProfileSection(userId: number, section: ProfileSection): string {
  const db = getDb();
  const row = db
    .prepare("SELECT content FROM profiles WHERE user_id = ? AND section = ?")
    .get(userId, section) as { content: string } | undefined;
  return row?.content ?? "{}";
}

export function upsertProfileSection(userId: number, section: ProfileSection, content: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO profiles (user_id, section, content, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, section)
    DO UPDATE SET content = excluded.content, updated_at = datetime('now')
  `).run(userId, section, content);
}

export function isProfileEmpty(userId: number): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as count FROM profiles WHERE user_id = ? AND content != '{}'")
    .get(userId) as { count: number };
  return row.count === 0;
}

export function deleteUserProfile(userId: number): void {
  const db = getDb();
  db.prepare("DELETE FROM profiles WHERE user_id = ?").run(userId);
}

export function formatProfileForPrompt(userId: number): string {
  const profile = getProfile(userId);
  const sections: string[] = [];

  for (const section of PROFILE_SECTIONS) {
    const content = profile[section];
    if (content && content !== "{}") {
      try {
        const parsed = JSON.parse(content);
        if (Object.keys(parsed).length > 0) {
          sections.push(`## ${section.charAt(0).toUpperCase() + section.slice(1)}\n${JSON.stringify(parsed, null, 2)}`);
        }
      } catch {
        if (content.trim().length > 2) {
          sections.push(`## ${section.charAt(0).toUpperCase() + section.slice(1)}\n${content}`);
        }
      }
    }
  }

  if (sections.length === 0) return "";
  return `# User Profile\n\n${sections.join("\n\n")}`;
}
