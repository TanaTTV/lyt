import process from "node:process";

const MINIMUM_YT_DLP_NODE_MAJOR = 22;

// yt-dlp requires an explicitly enabled JavaScript runtime for reliable
// YouTube extraction. lyt already runs under Node, so reuse that exact
// executable when its version meets yt-dlp's supported minimum.
export function ytDlpJsRuntimeArgs({
  execPath = process.execPath,
  nodeVersion = process.versions.node,
} = {}) {
  const major = Number.parseInt(String(nodeVersion).split(".")[0], 10);

  if (
    !Number.isInteger(major) ||
    major < MINIMUM_YT_DLP_NODE_MAJOR ||
    typeof execPath !== "string" ||
    execPath.trim() === ""
  ) {
    return [];
  }

  return ["--js-runtimes", `node:${execPath}`];
}
