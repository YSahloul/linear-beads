/**
 * Spawn background sync worker if not already running
 */

import { spawn, spawnSync } from "child_process";
import { openSync, closeSync } from "fs";
import { join, dirname } from "path";
import { isWorkerRunning } from "./pid-manager.js";
import { getPendingOutboxItems } from "./database.js";
import { getDbPath } from "./config.js";

const STALE_THRESHOLD_MS = 10000; // 10 seconds

/**
 * Get the command and args to run the worker
 */
function getWorkerCommand(): { cmd: string; args: string[] } {
  const execPath = process.execPath;
  const isCompiled = execPath.endsWith("/lb") || execPath.endsWith("\\lb.exe");

  if (isCompiled) {
    return { cmd: execPath, args: ["--worker"] };
  } else {
    // Dev mode: use URL-based resolution for robustness
    const cliPath = new URL("../cli.ts", import.meta.url).pathname;
    return { cmd: execPath, args: ["run", cliPath, "--worker"] };
  }
}

function getLogFilePath(): string {
  return join(dirname(getDbPath()), "sync.log");
}

/**
 * Spawn background sync worker if needed
 * Returns true if spawned, false if already running
 */
export function spawnWorkerIfNeeded(): boolean {
  if (isWorkerRunning()) {
    return false;
  }

  try {
    const { cmd, args } = getWorkerCommand();
    
    // Log to file for debugging spawn failures
    const logFd = openSync(getLogFilePath(), "a");

    const worker = spawn(cmd, args, {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      cwd: process.cwd(),
    });

    worker.unref();
    closeSync(logFd);

    return true;
  } catch (error) {
    console.error("Warning: Failed to spawn background sync worker:", error);
    return false;
  }
}

/**
 * Check if there are stale items in the outbox (worker probably failed)
 */
function hasStaleOutboxItems(): boolean {
  const items = getPendingOutboxItems();
  if (items.length === 0) return false;

  const oldest = items[0];
  const age = Date.now() - new Date(oldest.created_at).getTime();
  return age > STALE_THRESHOLD_MS;
}

/**
 * Process outbox synchronously (fallback when worker failed)
 */
function processOutboxSync(): void {
  const { cmd, args } = getWorkerCommand();
  spawnSync(cmd, args, {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

/**
 * Ensure outbox will be processed.
 * - If worker is running, trust it
 * - If stale items exist, process synchronously (worker probably died)
 * - Otherwise spawn worker
 */
export function ensureOutboxProcessed(): void {
  // If stale items exist, worker probably failed - process synchronously
  if (hasStaleOutboxItems()) {
    if (!isWorkerRunning()) {
      processOutboxSync();
      return;
    }
  }

  // Normal path: spawn worker
  spawnWorkerIfNeeded();
}
