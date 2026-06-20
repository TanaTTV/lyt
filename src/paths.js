// Per-user data directory for everything lyt persists: managed binaries,
// download history, and the config file.
//
//   Windows  %LOCALAPPDATA%\lyt
//   macOS    ~/Library/Application Support/lyt
//   Linux    $XDG_DATA_HOME/lyt or ~/.local/share/lyt

import { join } from "node:path";
import process from "node:process";

export function dataDir() {
  switch (process.platform) {
    case "win32": {
      if (!process.env.LOCALAPPDATA && !process.env.USERPROFILE) {
        throw new Error(
          "LOCALAPPDATA and USERPROFILE are undefined; cannot determine the lyt data directory.",
        );
      }

      return join(
        process.env.LOCALAPPDATA ??
          join(process.env.USERPROFILE, "AppData", "Local"),
        "lyt",
      );
    }
    case "darwin": {
      if (!process.env.HOME) {
        throw new Error("HOME is undefined; cannot determine the lyt data directory.");
      }

      return join(
        process.env.HOME,
        "Library",
        "Application Support",
        "lyt",
      );
    }
    default: {
      if (!process.env.XDG_DATA_HOME && !process.env.HOME) {
        throw new Error(
          "XDG_DATA_HOME and HOME are undefined; cannot determine the lyt data directory.",
        );
      }

      return join(
        process.env.XDG_DATA_HOME ??
          join(process.env.HOME, ".local", "share"),
        "lyt",
      );
    }
  }
}

// Where managed yt-dlp/ffmpeg binaries live (see bootstrap.js).
export function binDir() {
  return join(dataDir(), "bin");
}
