/**
 * Spawn background sync worker if not already running
 */

import { spawn } from "child_process";
import { isWorkerRunning } from "./pid-manager.js";

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
    // Get the real executable path
    // When compiled with bun, process.execPath gives us the actual binary path
    const realExecPath = process.execPath;

    const worker = spawn(realExecPath, ["--worker"], {
      detached: true,
      stdio: "ignore",
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
