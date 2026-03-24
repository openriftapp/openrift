Finalize work in a worktree — run checks, add changelog, and mark as ready to merge.

## Prerequisites

Must be on a worktree branch, not main. If on main, abort and tell the user to use `/commit-main` instead.

## Steps

1. **Commit any uncommitted work** using the `/commit all` flow (stage everything, present plan, wait for confirmation).

2. **Changelog check.** Look at all commits on this branch (`git log main..HEAD`). If any are `feat:` or `fix:`, check whether `apps/web/src/CHANGELOG.md` already has a corresponding entry. If not, add one (following the rules in CLAUDE.md) and commit it.

3. **Run `bun run check`** (build, lint, test, integration test). If it fails, fix the issues, commit the fixes, and re-run until it passes. Do not skip this step.

4. **Report the result:**

   ```
   ✓ All checks passed. Ready to merge.

   Branch: <branch name>
   Commits: <N>
   Summary: <one-line description of the work>

   Run `/merge` from main to squash-merge this branch.
   ```
