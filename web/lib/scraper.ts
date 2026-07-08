import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

const REPO_ROOT = process.env.REPO_ROOT || path.join(process.cwd(), "..");
const SKILLS_ROOT = path.join(REPO_ROOT, ".agents", "skills");

export interface ScrapedJob {
  portal: string;
  title: string;
  company: string | null;
  url: string | null;
  location: string | null;
  snippet: string | null;
}

interface PortalConfig {
  dir: string;
  queryFlag: string;
  parseResults: (raw: unknown) => ScrapedJob[];
}

const PORTALS: Record<string, PortalConfig> = {
  jobindex: {
    dir: "jobindex-search",
    queryFlag: "--query",
    parseResults(raw: unknown): ScrapedJob[] {
      const data = raw as { results?: Array<{ title?: string; company?: string; url?: string; location?: string; description?: string }> };
      return (data.results || []).map((r) => ({
        portal: "jobindex",
        title: r.title || "Untitled",
        company: r.company || null,
        url: r.url || null,
        location: r.location || null,
        snippet: r.description || null,
      }));
    },
  },
  jobbank: {
    dir: "jobbank-search",
    queryFlag: "--key",
    parseResults(raw: unknown): ScrapedJob[] {
      const data = raw as { results?: Array<{ title?: string; company?: string; url?: string; location?: string; description?: string }> };
      return (data.results || []).map((r) => ({
        portal: "jobbank",
        title: r.title || "Untitled",
        company: r.company || null,
        url: r.url || null,
        location: r.location || null,
        snippet: r.description || null,
      }));
    },
  },
  jobdanmark: {
    dir: "jobdanmark-search",
    queryFlag: "--text",
    parseResults(raw: unknown): ScrapedJob[] {
      const data = raw as { results?: Array<{ title?: string; companyName?: string; url?: string; companyAddress?: string }> };
      return (data.results || []).map((r) => ({
        portal: "jobdanmark",
        title: r.title || "Untitled",
        company: r.companyName || null,
        url: r.url || null,
        location: r.companyAddress || null,
        snippet: null,
      }));
    },
  },
  jobnet: {
    dir: "jobnet-search",
    queryFlag: "--search-string",
    parseResults(raw: unknown): ScrapedJob[] {
      const data = raw as { results?: Array<{ jobAdId?: string; title?: string; hiringOrgName?: string; municipality?: string; postalDistrictName?: string }> };
      return (data.results || []).map((r) => ({
        portal: "jobnet",
        title: r.title || "Untitled",
        company: r.hiringOrgName || null,
        url: r.jobAdId ? `https://job.jobnet.dk/CV/FindWork/Details/${r.jobAdId}` : null,
        location: r.municipality || r.postalDistrictName || null,
        snippet: null,
      }));
    },
  },
  linkedin: {
    dir: "linkedin-search",
    queryFlag: "--query",
    parseResults(raw: unknown): ScrapedJob[] {
      const data = raw as { results?: Array<{ title?: string; company?: string; url?: string; location?: string }> };
      return (data.results || []).map((r) => ({
        portal: "linkedin",
        title: r.title || "Untitled",
        company: r.company || null,
        url: r.url || null,
        location: r.location || null,
        snippet: null,
      }));
    },
  },
};

export interface ScrapeOptions {
  query?: string;
  portals?: string[];
  limit?: number;
}

export interface ScrapeResult {
  portal: string;
  jobs: ScrapedJob[];
  error?: string;
}

async function runPortalSearch(
  portalName: string,
  config: PortalConfig,
  query: string,
  limit: number
): Promise<ScrapeResult> {
  const cliPath = path.join(SKILLS_ROOT, config.dir, "cli", "src", "cli.ts");
  const args = ["run", cliPath, "search", config.queryFlag, query, "--format", "json"];
  if (limit > 0) {
    args.push("--limit", String(limit));
  }
  if (portalName === "linkedin") {
    args.push("--location", "Denmark");
  }

  try {
    const { stdout } = await execFileAsync("bun", args, {
      cwd: path.join(SKILLS_ROOT, config.dir, "cli"),
      timeout: 30000,
      env: { ...process.env, NO_COLOR: "1" },
    });

    const parsed = JSON.parse(stdout);
    const jobs = config.parseResults(parsed);
    return { portal: portalName, jobs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { portal: portalName, jobs: [], error: msg };
  }
}

export async function scrapeJobs(options: ScrapeOptions): Promise<ScrapeResult[]> {
  const query = options.query || "";
  if (!query) {
    return [{ portal: "all", jobs: [], error: "No search query provided. Use: /scrape <keywords>" }];
  }

  const limit = options.limit || 10;
  const portalNames = options.portals || Object.keys(PORTALS);

  const results = await Promise.allSettled(
    portalNames
      .filter((name) => PORTALS[name])
      .map((name) => runPortalSearch(name, PORTALS[name], query, limit))
  );

  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { portal: "unknown", jobs: [], error: r.reason?.message || "Failed" }
  );
}
