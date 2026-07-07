import fs from "fs";
import path from "path";
import { formatProfileForPrompt, isProfileEmpty } from "./profile";
import { formatApplicationsForPrompt } from "./applications";

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

Be concise, direct, and actionable. When evaluating jobs, use the scoring framework provided. When writing documents, follow the templates and style guidelines.`;

const SETUP_INSTRUCTION = `The user has not set up their profile yet. Before you can help effectively, you need to learn about them. Ask them to tell you about themselves — their background, skills, experience, education, what they're looking for, and what matters to them in a role. Extract structured information from their answers and save it to their profile using the /setup flow.

Prompt them naturally: "I'd love to help with your job search! To get started, could you tell me a bit about yourself — your background, current role, key skills, and what kind of positions you're looking for?"`;

let cachedBasePrompt: string | null = null;

function getBasePrompt(): string {
  if (cachedBasePrompt) return cachedBasePrompt;

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

  cachedBasePrompt = sections.join("\n\n---\n\n");
  return cachedBasePrompt;
}

export function getSystemPrompt(dbUserId?: number): string {
  const base = getBasePrompt();

  if (dbUserId === undefined) return base;

  const profileEmpty = isProfileEmpty(dbUserId);
  if (profileEmpty) {
    return `${base}\n\n---\n\n${SETUP_INSTRUCTION}`;
  }

  const profileContext = formatProfileForPrompt(dbUserId);
  const applicationsContext = formatApplicationsForPrompt(dbUserId);

  const parts = [base];
  if (profileContext) parts.push(profileContext);
  if (applicationsContext) parts.push(applicationsContext);

  return parts.join("\n\n---\n\n");
}
