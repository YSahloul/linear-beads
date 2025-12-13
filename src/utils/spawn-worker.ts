/**
 * Spawn background sync worker if not already running
 */

import { spawn } from "child_process";
import { isWorkerRunning } from "./pid-manager.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

/**
 * Spawn background sync worker if needed
 * Returns true if spawned, false if already running
 */
export function spawnWorkerIfNeeded(): boolean {
  // Check if worker already running
  if (isWorkerRunning()) {
    return false;
  }

  try {
    // Get path to worker script
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const workerPath = join(__dirname, "background-sync-worker.ts");

    // Spawn detached worker process
    const worker = spawn("bun", [workerPath], {
      detached: true,
      stdio: "ignore", // Ignore stdout/stderr
    });

    // Unref so parent can exit
    worker.unref();

    return true;
  } catch (error) {
    // Log but don't fail - user can manually sync
    console.error("Warning: Failed to spawn background sync worker:", error);
    return false;
  }
}
