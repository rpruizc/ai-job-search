#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
fail() { printf "${RED}✗${NC} %s\n" "$1"; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AI Job Search — Setup & Launch"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

errors=0

# --- Prerequisites ---
echo "Checking prerequisites..."
echo ""

if command -v claude &>/dev/null; then
  ok "Claude Code CLI found"
else
  fail "Claude Code CLI not found — install with: npm install -g @anthropic-ai/claude-code"
  errors=$((errors + 1))
fi

if command -v bun &>/dev/null; then
  ok "Bun $(bun --version) found"
else
  fail "Bun not found — install with: curl -fsSL https://bun.sh/install | bash"
  errors=$((errors + 1))
fi

if command -v python3 &>/dev/null; then
  ok "Python $(python3 --version 2>&1 | cut -d' ' -f2) found"
else
  warn "Python 3 not found — salary lookup will be unavailable"
fi

if command -v lualatex &>/dev/null; then
  ok "lualatex found (CV compilation)"
else
  warn "lualatex not found — CV compilation unavailable (install MacTeX: brew install --cask mactex-no-gui)"
fi

if command -v xelatex &>/dev/null; then
  ok "xelatex found (cover letter compilation)"
else
  warn "xelatex not found — cover letter compilation unavailable (install MacTeX: brew install --cask mactex-no-gui)"
fi

if command -v pdftotext &>/dev/null; then
  ok "pdftotext found (ATS check)"
else
  warn "pdftotext not found — ATS check will be skipped (install with: brew install poppler)"
fi

echo ""

if [ $errors -gt 0 ]; then
  fail "Missing required dependencies. Fix the above errors and re-run."
  exit 1
fi

# --- Install bun dependencies for job search CLIs ---
echo "Installing job search CLI dependencies..."
echo ""

for tool in jobbank-search jobdanmark-search jobindex-search jobnet-search linkedin-search; do
  cli_dir=".agents/skills/$tool/cli"
  if [ -d "$cli_dir" ]; then
    if [ -d "$cli_dir/node_modules" ] && [ "$(ls "$cli_dir/node_modules" 2>/dev/null | wc -l)" -gt 0 ]; then
      ok "$tool (already installed)"
    else
      (cd "$cli_dir" && bun install --silent 2>/dev/null) && ok "$tool" || warn "$tool (install failed — non-critical)"
    fi
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ready! Launching Claude Code..."
echo ""
echo "  Quick start commands inside Claude:"
echo "    /setup   — Set up your profile"
echo "    /scrape  — Search job portals"
echo "    /apply   — Apply to a specific job"
echo "    /rank    — Triage scraped jobs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exec claude
