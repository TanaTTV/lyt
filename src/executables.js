import { accessSync, statSync } from "node:fs";
import { posix, win32 } from "node:path";
import process from "node:process";
import { constants } from "node:fs";

// Resolve only through explicit absolute PATH entries. Native executable
// lookup may search the current working directory on Windows, which lets an
// unrelated project folder shadow trusted tools such as yt-dlp or ffmpeg.
export function resolveExecutableOnPath(
  command,
  {
    env = process.env,
    platform = process.platform,
    canExecute = defaultCanExecute,
  } = {},
) {
  const pathApi = platform === "win32" ? win32 : posix;
  if (pathApi.isAbsolute(command)) return canExecute(command, platform) ? command : null;
  if (command.includes("/") || command.includes("\\")) return null;

  const pathValue = env.PATH ?? env.Path ?? env.path ?? "";
  const extensions = platform === "win32"
    ? executableExtensions(command, env.PATHEXT, pathApi)
    : [""];

  const pathDelimiter = platform === "win32" ? ";" : ":";
  for (const entry of pathValue.split(pathDelimiter)) {
    const directory = entry.trim().replace(/^"|"$/g, "");
    if (!directory || !pathApi.isAbsolute(directory)) continue;

    for (const extension of extensions) {
      const candidate = pathApi.join(directory, `${command}${extension}`);
      if (canExecute(candidate, platform)) return candidate;
    }
  }

  return null;
}

function executableExtensions(command, pathExt = ".COM;.EXE;.BAT;.CMD", pathApi = win32) {
  if (pathApi.extname(command)) return [""];
  return String(pathExt)
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
}

function defaultCanExecute(file, platform) {
  try {
    accessSync(file, platform === "win32" ? constants.F_OK : constants.X_OK);
    return statSync(file).isFile();
  } catch {
    return false;
  }
}
