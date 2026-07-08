import { getDb } from "./db";
import { scrapeJobs, ScrapeResult } from "./scraper";
import { chatStream, Message } from "./claude";
import { getSystemPrompt } from "./system-prompt";
import { updateApplication } from "./applications";

export interface CommandResult {
  handled: boolean;
  response?: string;
  stream?: boolean;
}

interface ParsedCommand {
  name: string;
  args: string;
}

export function parseCommand(message: string): ParsedCommand | null {
  const trimmed = message.trim();
  const match = trimmed.match(/^\/(\w+)(?:\s+([\s\S]*))?/);
  if (!match) return null;
  return { name: match[1].toLowerCase(), args: (match[2] || "").trim() };
}

export async function handleCommand(
  command: ParsedCommand,
  userId: number,
  conversationId: number,
  conversationMessages: Message[],
  onText: (text: string) => void,
  onComplete: (usage: { input_tokens: number; output_tokens: number }) => void,
  onError: (error: Error) => void
): Promise<CommandResult> {
  switch (command.name) {
    case "scrape":
      return handleScrape(command.args, userId, onText);
    case "rank":
      return handleRank(userId, conversationMessages, onText, onComplete, onError);
    case "apply":
      return handleApply(command.args, userId, conversationMessages, onText, onComplete, onError);
    case "outcome":
      return handleOutcome(command.args, userId, onText);
    default:
      return { handled: false };
  }
}

async function handleScrape(
  args: string,
  userId: number,
  onText: (text: string) => void
): Promise<CommandResult> {
  const parts = args.split(/\s+/);
  let portals: string[] | undefined;
  let query = args;

  const portalFlag = parts.findIndex((p) => p === "--portal" || p === "-p");
  if (portalFlag >= 0 && parts[portalFlag + 1]) {
    portals = parts[portalFlag + 1].split(",");
    query = [...parts.slice(0, portalFlag), ...parts.slice(portalFlag + 2)].join(" ");
  }

  if (!query) {
    onText("Please provide search keywords. Usage: `/scrape <keywords>` (e.g. `/scrape python developer`)");
    return { handled: true };
  }

  onText(`Searching for "${query}" across ${portals ? portals.join(", ") : "all portals"}...\n\n`);

  let results: ScrapeResult[];
  try {
    results = await scrapeJobs({ query, portals, limit: 10 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    onText(`Error running scraper: ${msg}`);
    return { handled: true };
  }

  const db = getDb();
  let totalNew = 0;
  let totalDuplicates = 0;
  const portalSummaries: string[] = [];

  for (const result of results) {
    if (result.error) {
      portalSummaries.push(`**${result.portal}**: Error - ${result.error}`);
      continue;
    }

    let newCount = 0;
    let dupCount = 0;

    for (const job of result.jobs) {
      const existing = db
        .prepare(
          "SELECT id FROM scraped_jobs WHERE user_id = ? AND portal = ? AND title = ? AND company IS ?"
        )
        .get(userId, job.portal, job.title, job.company) as { id: number } | undefined;

      if (existing) {
        dupCount++;
        continue;
      }

      db.prepare(
        "INSERT INTO scraped_jobs (user_id, portal, title, company, url, location, snippet) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(userId, job.portal, job.title, job.company, job.url, job.location, job.snippet);
      newCount++;
    }

    totalNew += newCount;
    totalDuplicates += dupCount;
    portalSummaries.push(
      `**${result.portal}**: ${result.jobs.length} found, ${newCount} new, ${dupCount} duplicates`
    );
  }

  let summary = `## Scrape Results\n\n`;
  summary += portalSummaries.join("\n") + "\n\n";
  summary += `**Total:** ${totalNew} new jobs saved`;
  if (totalDuplicates > 0) {
    summary += ` (${totalDuplicates} duplicates skipped)`;
  }
  summary += "\n\nUse `/rank` to evaluate and rank the new jobs against your profile.";

  onText(summary);
  return { handled: true };
}

async function handleRank(
  userId: number,
  conversationMessages: Message[],
  onText: (text: string) => void,
  onComplete: (usage: { input_tokens: number; output_tokens: number }) => void,
  onError: (error: Error) => void
): Promise<CommandResult> {
  const db = getDb();
  const unranked = db
    .prepare(
      "SELECT id, portal, title, company, url, location, snippet FROM scraped_jobs WHERE user_id = ? AND ranked = 0 ORDER BY scraped_at DESC LIMIT 20"
    )
    .all(userId) as Array<{
    id: number;
    portal: string;
    title: string;
    company: string | null;
    url: string | null;
    location: string | null;
    snippet: string | null;
  }>;

  if (unranked.length === 0) {
    onText("No unranked jobs found. Use `/scrape <keywords>` to find new jobs first.");
    return { handled: true };
  }

  const jobList = unranked
    .map(
      (j, i) =>
        `${i + 1}. **${j.title}** at ${j.company || "Unknown"} (${j.portal})${j.location ? ` - ${j.location}` : ""}${j.snippet ? `\n   ${j.snippet.slice(0, 150)}` : ""}`
    )
    .join("\n");

  const rankingPrompt = `The user wants you to rank the following unranked job listings against their profile. For each job, provide:
- A score from 1-10 (10 = perfect fit)
- A brief note explaining the score

Format your response as a ranking from best to worst fit. After your analysis, output a JSON block with the rankings in this exact format:
\`\`\`json
[{"index": 1, "score": 8.5, "notes": "Strong match because..."}, ...]
\`\`\`

Here are the jobs to rank:
${jobList}`;

  const messages: Message[] = [
    ...conversationMessages.slice(-10),
    { role: "user", content: rankingPrompt },
  ];

  const systemPrompt = getSystemPrompt(userId);
  let fullResponse = "";

  onText(`Ranking ${unranked.length} unranked jobs against your profile...\n\n`);

  await chatStream(messages, { system: systemPrompt }, {
    onText(text) {
      fullResponse += text;
      onText(text);
    },
    onComplete(usage) {
      const jsonMatch = fullResponse.match(/```json\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try {
          const rankings = JSON.parse(jsonMatch[1]) as Array<{ index: number; score: number; notes: string }>;
          for (const rank of rankings) {
            const job = unranked[rank.index - 1];
            if (job) {
              db.prepare(
                "UPDATE scraped_jobs SET ranked = 1, rank_score = ?, rank_notes = ? WHERE id = ?"
              ).run(rank.score, rank.notes, job.id);
            }
          }
        } catch {
          // Rankings couldn't be parsed, that's ok - the text response is still shown
        }
      }
      onComplete(usage);
    },
    onError,
  });

  return { handled: true, stream: true };
}

async function handleApply(
  args: string,
  userId: number,
  conversationMessages: Message[],
  onText: (text: string) => void,
  onComplete: (usage: { input_tokens: number; output_tokens: number }) => void,
  onError: (error: Error) => void
): Promise<CommandResult> {
  if (!args) {
    onText("Please provide a job URL or paste the job posting text. Usage: `/apply <url or text>`");
    return { handled: true };
  }

  const applyPrompt = `The user wants to apply to a job. Here is the job posting information:

${args}

Please:
1. First, evaluate the fit against the user's profile (skills match, experience match, culture/behavioral match). Present a clear assessment with scores.
2. If it's a reasonable fit (score >= 5/10), proceed to outline what a tailored CV and cover letter should emphasize.
3. Ask the user if they'd like you to proceed with creating the application materials.

Use the job evaluation framework from your instructions.`;

  const messages: Message[] = [
    ...conversationMessages.slice(-10),
    { role: "user", content: applyPrompt },
  ];

  const systemPrompt = getSystemPrompt(userId);

  await chatStream(messages, { system: systemPrompt }, {
    onText,
    onComplete,
    onError,
  });

  return { handled: true, stream: true };
}

async function handleOutcome(
  args: string,
  userId: number,
  onText: (text: string) => void
): Promise<CommandResult> {
  if (!args) {
    onText(
      "Please provide the company name and outcome. Usage: `/outcome <company> <status>`\n\n" +
        "Valid statuses: `applied`, `interviewing`, `offered`, `rejected`, `accepted`, `withdrawn`"
    );
    return { handled: true };
  }

  const validStatuses = ["applied", "interviewing", "offered", "rejected", "accepted", "withdrawn"];
  const parts = args.split(/\s+/);

  if (parts.length < 2) {
    onText(
      "Please provide both company name and status. Usage: `/outcome <company> <status>`\n\n" +
        "Valid statuses: `applied`, `interviewing`, `offered`, `rejected`, `accepted`, `withdrawn`"
    );
    return { handled: true };
  }

  const status = parts[parts.length - 1].toLowerCase();
  const company = parts.slice(0, -1).join(" ");

  if (!validStatuses.includes(status)) {
    onText(
      `Invalid status "${status}". Valid statuses: ${validStatuses.map((s) => `\`${s}\``).join(", ")}`
    );
    return { handled: true };
  }

  const db = getDb();
  const application = db
    .prepare(
      "SELECT id, company, role, status FROM applications WHERE user_id = ? AND LOWER(company) LIKE ? ORDER BY updated_at DESC LIMIT 1"
    )
    .get(userId, `%${company.toLowerCase()}%`) as { id: number; company: string; role: string; status: string } | undefined;

  if (!application) {
    onText(
      `No application found matching "${company}". Check your tracked applications or create one first with \`/apply\`.`
    );
    return { handled: true };
  }

  const updated = updateApplication(userId, application.id, {
    status: status as "applied" | "interviewing" | "offered" | "rejected" | "accepted" | "withdrawn",
  });

  if (updated) {
    onText(
      `Updated **${application.company}** (${application.role}): ${application.status} → **${status}**`
    );
  } else {
    onText(`Failed to update the application status. Please try again.`);
  }

  return { handled: true };
}
