/**
 * lb onboard - Alias for `lb init`.
 *
 * Kept for backward compatibility. All setup (auth + init + sync)
 * is now handled by `lb init` directly.
 */

import { Command } from "commander";
import { output } from "../utils/output.js";

export const onboardCommand = new Command("onboard")
  .description("Set up lb for this repo (alias for lb init)")
  .option("--force", "Re-initialize even if .lb/ already exists")
  .option("--scope <mode>", "How to scope issues: project, label, or both", "project")
  .action(async (options) => {
    const { execSync } = await import("child_process");
    const args = ["lb init"];
    if (options.force) args.push("--force");
    if (options.scope) args.push(`--scope ${options.scope}`);
    try {
      execSync(args.join(" "), { stdio: "inherit" });
    } catch {
      output("lb onboard failed. Run `lb init` manually.");
      process.exit(1);
    }
  });
