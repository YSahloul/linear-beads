/**
 * lb worktree - Create, list, and delete git worktrees for issue branches
 *
 * Automates the full worktree lifecycle:
 *   create: git worktree add + copy .env files + symlink shared dirs + lb onboard + lb sync
 *   delete: safety checks + git worktree remove
 *   list:   show active worktrees
 */

import { Command } from "commander";
import { execSync } from "child_process";
import {
  existsSync,
  statSync,
  lstatSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
  symlinkSync,
} from "fs";
import { dirname, join, resolve, relative } from "path";
import { output, outputError } from "../utils/output.js";

/**
 * Get the main repo root (works from worktrees too)
 */
function getRepoRoot(): string {
  return execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
}

/**
 * Detect the default branch (main or master)
 */
function getDefaultBranch(): string {
  try {
    // Check remote HEAD first
    const ref = execSync("git symbolic-ref refs/remotes/origin/HEAD", {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
    return ref.replace("refs/remotes/origin/", "");
  } catch {
    // Fallback: check if main exists, otherwise master
    try {
      execSync("git rev-parse --verify main", { encoding: "utf-8", stdio: "pipe" });
      return "main";
    } catch {
      return "master";
    }
  }
}

/**
 * Find all .env files recursively, excluding common build/dependency dirs
 */
function findEnvFiles(dir: string): string[] {
  const results: string[] = [];
  const excludeDirs = new Set([
    "node_modules",
    ".wrangler",
    "dist",
    ".next",
    ".open-next",
    ".git",
    ".lb",
  ]);

  function walk(current: string) {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!excludeDirs.has(entry.name)) {
          walk(join(current, entry.name));
        }
      } else if (entry.name.startsWith(".env")) {
        results.push(join(current, entry.name));
      }
    }
  }

  walk(dir);
  return results;
}

// ─── lb worktree create ───────────────────────────────────────────────

const createCommand = new Command("create")
  .description("Create a worktree for an issue branch")
  .argument("<branch>", 'Branch name (e.g. "AGE-42-fix-auth")')
  .option("--base <branch>", "Base branch to create from (auto-detects main/master)")
  .option("--no-onboard", "Skip running lb onboard in the worktree")
  .option("--no-sync", "Skip running lb sync in the worktree")
  .action(async (branch: string, options) => {
    try {
      const repoRoot = getRepoRoot();
      const parentDir = dirname(repoRoot);
      const wtPath = join(parentDir, branch);
      const baseBranch = options.base || getDefaultBranch();

      // Check if worktree path already exists
      if (existsSync(wtPath)) {
        outputError(`Worktree path already exists: ${wtPath}`);
        outputError(`Remove it first with: lb worktree delete ${branch}`);
        process.exit(1);
      }

      // Check if branch already exists
      let branchExists = false;
      try {
        execSync(`git rev-parse --verify ${branch}`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
        branchExists = true;
      } catch {
        // Branch doesn't exist, we'll create it
      }

      // 1. Create the worktree
      output(`Creating worktree at ${wtPath}...`);
      if (branchExists) {
        execSync(`git worktree add "${wtPath}" ${branch}`, {
          cwd: repoRoot,
          stdio: "pipe",
        });
      } else {
        execSync(`git worktree add "${wtPath}" -b ${branch} ${baseBranch}`, {
          cwd: repoRoot,
          stdio: "pipe",
        });
      }
      output(`  Branch: ${branch} (${branchExists ? "existing" : `new from ${baseBranch}`})`);

      // 2. Copy .env files (preserving directory structure)
      const envFiles = findEnvFiles(repoRoot);
      if (envFiles.length > 0) {
        output(`Copying ${envFiles.length} .env file(s)...`);
        for (const envFile of envFiles) {
          const relPath = relative(repoRoot, envFile);
          const destPath = join(wtPath, relPath);
          const destDir = dirname(destPath);

          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
          }
          copyFileSync(envFile, destPath);
          output(`  ${relPath}`);
        }
      }

      // 3. Symlink shared directories
      const symlinkTargets = ["node_modules", ".opencode", ".claude"];
      for (const target of symlinkTargets) {
        const srcPath = join(repoRoot, target);
        const destPath = join(wtPath, target);

        if (existsSync(srcPath) && !existsSync(destPath)) {
          try {
            symlinkSync(srcPath, destPath);
            output(`Symlinked ${target}/`);
          } catch (err) {
            // If symlink fails (e.g. already exists as dir), warn but continue
            outputError(
              `  Warning: Could not symlink ${target}: ${err instanceof Error ? err.message : err}`
            );
          }
        }
      }

      // 4. Run lb onboard in the worktree (unless --no-onboard)
      if (options.onboard !== false) {
        output("Running lb onboard...");
        try {
          execSync("lb onboard", { cwd: wtPath, stdio: "pipe" });
        } catch {
          // Onboard may fail if auth/init already done — that's fine
          output("  (skipped — already onboarded)");
        }
      }

      // 5. Run lb sync in the worktree (unless --no-sync)
      if (options.sync !== false) {
        output("Running lb sync...");
        try {
          execSync("lb sync", { cwd: wtPath, stdio: "inherit" });
        } catch {
          outputError("  Warning: lb sync failed");
        }
      }

      output("");
      output(`Worktree ready: ${wtPath}`);
      output(`  cd "${wtPath}" to start working`);
    } catch (error) {
      outputError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// ─── lb worktree delete ───────────────────────────────────────────────

const deleteCommand = new Command("delete")
  .description("Remove a worktree (with safety checks)")
  .argument("<branch>", "Branch name of the worktree to remove")
  .option("-f, --force", "Skip safety checks and force removal")
  .action(async (branch: string, options) => {
    try {
      const repoRoot = getRepoRoot();
      const parentDir = dirname(repoRoot);
      const wtPath = join(parentDir, branch);

      if (!existsSync(wtPath)) {
        outputError(`Worktree not found: ${wtPath}`);
        process.exit(1);
      }

      if (!options.force) {
        // Check for uncommitted changes (ignore symlinked dirs like node_modules)
        try {
          const status = execSync("git status --porcelain", {
            cwd: wtPath,
            encoding: "utf-8",
          }).trim();

          if (status) {
            // Filter out lines that are just symlinked directories we created
            const meaningful = status.split("\n").filter((line) => {
              const file = line.slice(3).trim();
              const fullPath = join(wtPath, file);
              try {
                const lstat = lstatSync(fullPath);
                return !lstat.isSymbolicLink();
              } catch {
                return true; // Can't stat — keep the line
              }
            });

            if (meaningful.length > 0) {
              outputError(`Worktree has uncommitted changes:\n${meaningful.join("\n")}`);
              outputError(`Use --force to remove anyway, or commit/stash first.`);
              process.exit(1);
            }
          }
        } catch {
          // If git status fails, the worktree may be broken — allow force
        }

        // Check for unpushed commits
        try {
          const unpushed = execSync("git log --oneline @{upstream}..HEAD", {
            cwd: wtPath,
            encoding: "utf-8",
            stdio: "pipe",
          }).trim();

          if (unpushed) {
            outputError(`Worktree has unpushed commits:\n${unpushed}`);
            outputError(`Use --force to remove anyway, or push first.`);
            process.exit(1);
          }
        } catch {
          // No upstream or git log fails — that's okay, may be a local-only branch
        }
      }

      // Remove the worktree
      output(`Removing worktree: ${wtPath}`);
      execSync(`git worktree remove "${wtPath}" --force`, {
        cwd: repoRoot,
        stdio: "pipe",
      });

      output(`Worktree removed: ${branch}`);
    } catch (error) {
      outputError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// ─── lb worktree list ─────────────────────────────────────────────────

const listCommand = new Command("list")
  .description("List active worktrees")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    try {
      const raw = execSync("git worktree list --porcelain", {
        encoding: "utf-8",
      }).trim();

      if (!raw) {
        output("No worktrees found.");
        return;
      }

      // Parse porcelain output
      const worktrees: Array<{
        path: string;
        head: string;
        branch: string;
        bare: boolean;
      }> = [];

      let current: Record<string, string> = {};
      for (const line of raw.split("\n")) {
        if (line.startsWith("worktree ")) {
          if (current.path) worktrees.push(parseCurrent(current));
          current = { path: line.slice("worktree ".length) };
        } else if (line.startsWith("HEAD ")) {
          current.head = line.slice("HEAD ".length);
        } else if (line.startsWith("branch ")) {
          current.branch = line.slice("branch ".length).replace("refs/heads/", "");
        } else if (line === "bare") {
          current.bare = "true";
        } else if (line === "" && current.path) {
          worktrees.push(parseCurrent(current));
          current = {};
        }
      }
      if (current.path) worktrees.push(parseCurrent(current));

      function parseCurrent(c: Record<string, string>) {
        return {
          path: c.path || "",
          head: (c.head || "").slice(0, 8),
          branch: c.branch || "(detached)",
          bare: c.bare === "true",
        };
      }

      if (options.json) {
        output(JSON.stringify(worktrees, null, 2));
        return;
      }

      // Human-readable
      output("Active worktrees:\n");
      for (const wt of worktrees) {
        const marker = wt.bare ? " [bare]" : "";
        output(`  ${wt.branch}${marker}`);
        output(`    ${wt.path}  (${wt.head})`);
      }
      output("");
    } catch (error) {
      outputError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// ─── Main command ─────────────────────────────────────────────────────

export const worktreeCommand = new Command("worktree").description(
  "Manage git worktrees for issue branches"
);

worktreeCommand.addCommand(createCommand);
worktreeCommand.addCommand(deleteCommand);
worktreeCommand.addCommand(listCommand);
