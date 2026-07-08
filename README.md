<p align="center">
  <img src="claude_animation.gif" alt="AI Job Search Assistant" width="200">
</p>

# AI Job Search

An AI-powered job application assistant with two interfaces: a **CLI workflow** via [Claude Code](https://claude.com/claude-code) slash commands, and a **web app** (Next.js + Claude API) deployed on Fly.io.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Web App (web/)                                     │
│  Next.js · Clerk auth · Claude API · SQLite         │
│  Chat interface with slash commands                 │
│  Deployed on Fly.io (arn region)                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  CLI Workflow (.claude/commands/)                    │
│  Claude Code slash commands                         │
│  /setup · /scrape · /rank · /apply · /outcome      │
│  /expand · /upskill · /add-template · /add-portal   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Job Portal Scrapers (.agents/skills/)              │
│  Bun CLI tools: Jobindex · Jobnet · Jobbank ·      │
│  Jobdanmark · LinkedIn (country-agnostic)           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Document Generation (cv/ · cover_letters/)         │
│  LaTeX: moderncv (lualatex) · cover.cls (xelatex)  │
└─────────────────────────────────────────────────────┘
```

## Quick start

### CLI workflow

```bash
gh repo fork rpruizc/ai-job-search --clone && cd ai-job-search

# Install job portal scrapers
for dir in .agents/skills/*/cli; do (cd "$dir" && bun install); done

# Start Claude Code and onboard
claude
/setup        # builds your candidate profile from documents or interview
/scrape       # searches portals, deduplicates, rates fit
/rank         # batch-scores scraped jobs into a shortlist
/apply <url>  # full pipeline: evaluate → draft → review → compile PDFs
```

### Web app

```bash
cd web && cp .env.example .env.local
# Fill in: CLERK_*, AWS Bedrock credentials, etc.
npm install && npm run dev
```

The web app provides a chat interface backed by Claude (via AWS Bedrock), with user auth (Clerk), conversation persistence (SQLite), rate limiting, and admin tooling.

## Commands

| Command | Purpose |
|---------|---------|
| `/setup` | Profile onboarding (documents, CV import, or interview) |
| `/scrape` | Search job portals matching your profile |
| `/rank` | Score and rank scraped postings |
| `/apply` | Drafter-reviewer pipeline → tailored CV + cover letter |
| `/outcome` | Record application results, archive materials |
| `/expand` | Enrich profile from GitHub, portfolio, certifications |
| `/upskill` | Skill gap analysis + learning plan |
| `/add-template` | Register custom LaTeX templates |
| `/add-portal` | Generate a scraper for a new job board |
| `/reset` | Wipe profile data |

## How `/apply` works

1. Parse posting → evaluate fit against profile
2. Draft CV + cover letter in LaTeX
3. Reviewer agent critiques (separate context, fresh company research)
4. Revise → compile PDFs → visual inspection loop (page count, orphans, fonts)
5. ATS check: extract text layer, verify keywords and parseability
6. Present final output with verification checklist

Key properties: never fabricates skills, relevance-weighted cutting when CV overflows, PDF layout iteration until clean.

## Prerequisites

- [Bun](https://bun.sh) (job portal scrapers)
- LaTeX with `lualatex` + `xelatex` ([TeX Live](https://tug.org/texlive/) or [MiKTeX](https://miktex.org/))
- Python 3.10+ (salary benchmarking)
- Optional: `pdftotext` from [poppler](https://poppler.freedesktop.org/) (ATS text-layer check)

## Customization

- **Your own job boards:** `/add-portal` scaffolds a scraper from any public job site
- **Your own LaTeX templates:** `/add-template` registers and activates them
- **LinkedIn (any country):** `linkedin-search` works globally via `-l "City, Country"`
- **Salary data:** drop your own into `tools/` (see `README_SALARY_TOOL.md`)
- **Manual profile edits:** `CLAUDE.md` and files in `.claude/skills/job-application-assistant/`
