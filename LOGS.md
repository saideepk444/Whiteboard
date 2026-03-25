# AI Interaction Logs

Before your final commit, add a `logs/` directory to the repository root containing your AI interaction history.

We will not penalize you for AI use. We want to understand your workflow: how you directed the tools, what you accepted vs. rejected, and how you iterated.

## How to export

**Claude Code (CLI):** `claude export --output logs/claude-code.md` from your project directory. If you used multiple sessions, export each one.

**Aider:** Aider logs to `.aider.chat.history.md` in the project root. Copy it: `cp .aider.chat.history.md logs/aider.md`

**Cursor:** No built-in export. Open the Composer/Chat panel, select all, and paste into `logs/cursor-1.md`, `logs/cursor-2.md`, etc.

**GitHub Copilot Chat:** No built-in export. Copy-paste each conversation into `logs/copilot-1.md`, etc.

**Windsurf / Cascade:** No built-in export. Copy-paste from the Cascade panel into `logs/windsurf-1.md`, etc.

**OpenAI Codex CLI:** Copy the relevant session file(s) from `~/.codex/` into `logs/`.

**ChatGPT or Claude (web):** Use the share-link feature and save the URL(s) in `logs/web-links.md`, or copy-paste the full conversation.

**Multiple tools or parallel sessions:** Include all of them. Name files so it's clear which tool and roughly what order (e.g., `logs/claude-1-backend.md`, `logs/cursor-2-frontend.md`).

**Tool not listed?** Include whatever export your tool supports. If there's no export at all, a brief `logs/notes.md` describing which tools you used and roughly how is fine.
