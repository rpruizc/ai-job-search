import fs from "fs";
import path from "path";

const SKILLS_DIR = path.join(process.cwd(), "..", ".claude", "skills", "job-application-assistant");

const SKILL_FILES = [
  "01-candidate-profile.md",
  "02-behavioral-profile.md",
  "03-writing-style.md",
  "04-job-evaluation.md",
];

const ROLE_PREAMBLE = `You are a career advisor and job application assistant. You help users with:
- Evaluating job postings against their profile
- Tailoring CVs for specific roles
- Writing targeted cover letters
- Preparing for interviews
- Career strategy and positioning

Be concise, direct, and actionable. When evaluating jobs, use the scoring framework provided. When writing documents, follow the templates and style guidelines.

If the user's profile is not yet set up (sections show placeholder text like [YOUR_NAME]), let them know they should run /setup to populate their profile first.`;

let cachedPrompt: string | null = null;

export function getSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt;

  const sections: string[] = [ROLE_PREAMBLE];

  for (const file of SKILL_FILES) {
    const filePath = path.join(SKILLS_DIR, file);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        sections.push(content);
      }
    } catch {
      // Skip files that can't be read
    }
  }

  cachedPrompt = sections.join("\n\n---\n\n");
  return cachedPrompt;
}
