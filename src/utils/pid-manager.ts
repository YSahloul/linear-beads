/**
 * PID file management for background sync worker
 * Ensures only one sync worker runs per repo at a time
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { getDbPath } from "./config.js";

/**
 * Get PID file path for a repo
 */
function getPidFilePath(): string {
  const dbPath = getDbPath();
  const lbDir = dirname(dbPath);
  return join(lbDir, "sync.pid");
}

/**
 * Check if a process is alive
 */
function isProcessAlive(pid: number): boolean {
  try {
    // Send signal 0 to check if process exists (doesn't kill it)
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a background sync worker is already running
 * Returns true if worker is running, false otherwise
 */
export function isWorkerRunning(): boolean {
  const pidFile = getPidFilePath();

  if (!existsSync(pidFile)) {
    return false;
  }

  try {
    const pidStr = readFileSync(pidFile, "utf-8").trim();
    const pid = parseInt(pidStr);

    if (isNaN(pid)) {
      // Invalid PID file - remove it
      unlinkSync(pidFile);
      return false;
    }

    if (!isProcessAlive(pid)) {
      // Stale PID file - process died
      unlinkSync(pidFile);
      return false;
    }

    return true;
  } catch {
    // Error reading file - assume not running
    return false;
  }
}

/**
 * Write PID file for current process
 */
export function writePidFile(pid: number): void {
  const pidFile = getPidFilePath();
  const dir = dirname(pidFile);

  // Ensure directory exists
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(pidFile, pid.toString());
}

/**
 * Remove PID file when worker exits
 */
export function removePidFile(): void {
  const pidFile = getPidFilePath();

  if (existsSync(pidFile)) {
    try {
      unlinkSync(pidFile);
    } catch {
      // Ignore errors - file might not exist
    }
  }
}

/**
 * Kill running worker (for testing/cleanup)
 */
export function killWorker(): boolean {
  const pidFile = getPidFilePath();

  if (!existsSync(pidFile)) {
    return false;
  }

  try {
    const pidStr = readFileSync(pidFile, "utf-8").trim();
    const pid = parseInt(pidStr);

    if (isNaN(pid)) {
      unlinkSync(pidFile);
      return false;
    }

    if (isProcessAlive(pid)) {
      process.kill(pid, "SIGTERM");
      unlinkSync(pidFile);
      return true;
    }

    // Stale PID
    unlinkSync(pidFile);
    return false;
  } catch {
    return false;
  }
}
