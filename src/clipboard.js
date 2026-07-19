// Cross-platform clipboard reading using only tools the OS already ships:
// PowerShell on Windows, pbpaste on macOS, wl-paste/xclip/xsel on Linux.
// No npm dependencies, no native bindings.

import { spawnSync } from "node:child_process";
import process from "node:process";
import { resolveExecutableOnPath } from "./executables.js";

// Candidate readers per platform, tried in order until one works.
export function clipboardCommands(platform = process.platform) {
  if (platform === "win32") {
    return [
      [
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", "Get-Clipboard -Raw"],
      ],
    ];
  }

  if (platform === "darwin") {
    return [["pbpaste", []]];
  }

  return [
    ["wl-paste", ["--no-newline"]],
    ["xclip", ["-selection", "clipboard", "-o"]],
    ["xsel", ["--clipboard", "--output"]],
  ];
}

// Returns the clipboard text, or "" when it is empty, non-text, or no
// clipboard tool is available. `spawn` is injectable for testing.
export function readClipboard({
  platform = process.platform,
  spawn = spawnSync,
  resolve = (command) => resolveExecutableOnPath(command, { platform }),
} = {}) {
  for (const [command, args] of clipboardCommands(platform)) {
    try {
      const executable = resolve(command);
      if (!executable) continue;
      const result = spawn(executable, args, {
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true,
      });

      if (!result.error && result.status === 0 && typeof result.stdout === "string") {
        return result.stdout;
      }
    } catch {
      // Try the next candidate tool.
    }
  }

  return "";
}
