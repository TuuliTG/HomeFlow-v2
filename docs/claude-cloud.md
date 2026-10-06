# Coding from your phone with Claude Code on the web

Claude Code on the web runs the agent in a cloud sandbox with a clone of this repo. You start and steer it from the
Claude mobile app (Code tab) or claude.ai/code. It works on a branch and pushes. CI and the Vercel preview do the rest.

## One-time setup

1. **Connect GitHub** — open claude.ai/code (or the Code tab in the Claude app), sign in with GitHub and install the
   Claude GitHub app with access to `TuuliTG/HomeFlow-v2`.
2. **Create an environment** for the repo:
   - **Network access:** keep the default (trusted package registries, including npm). If Playwright browser
     downloads are blocked, that's fine: e2e still runs in CI.
   - **Environment variables:** none are needed for tests. Add `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` only
     if a session needs to talk to a real Supabase project (use a dev project, never production keys).
   - **Setup script:** leave empty. `.claude/hooks/session-start.sh` runs `npm ci` automatically when
     `CLAUDE_CODE_REMOTE=true`.
3. **Protect `main` on GitHub** (see README) so nothing reaches production without green CI.

## Daily loop

1. In the app, pick the HomeFlow repo/environment and describe the task, e.g.
   _"Implement the Available tasks list from the product brief with mock data, following feature-workflow."_
2. Claude reads `AGENTS.md` and the skills, works on a branch, runs `npm run verify` and pushes.
3. Ask it to open a PR (or tap _Create PR_). GitHub Actions runs CI, and Vercel comments a **preview URL**.
4. Open the preview on your phone, try it, and comment in the session (or on the PR) for changes.
5. Merge when CI is green. Vercel deploys `main` to production.

## Tips

- Keep tasks small (one screen or behaviour per session). It's faster to review on a phone.
- Say _"follow the feature-workflow skill"_ if a session skips steps.
- To continue a cloud session on your laptop, use _Open in CLI_ (teleport) from the session menu.
- Optional: install the Claude GitHub Action locally with `/install-github-app` to get automatic PR reviews and to
  mention `@claude` in PR comments.
