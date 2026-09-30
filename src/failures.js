// Stable machine-readable failure categories. Exit codes remain unchanged.
export const FAILURE_KINDS = {
  usage: [false, "Check the command arguments with lyt --help or lyt capabilities --json."],
  tool_missing: [false, "Run lyt doctor --json; authorize tool setup separately if needed."],
  tool_unavailable: [false, "The installed tool did not pass its startup check; inspect access and diagnostics before authorizing repair."],
  setup_failed: [false, "Run lyt doctor --json and resolve the reported tool setup failure."],
  network: [true, "Check connectivity and retry with a bounded retry policy."],
  rate_limited: [true, "Wait before retrying and reduce concurrent requests."],
  authentication_required: [false, "Use an accessible source; use authentication only when explicitly authorized."],
  access_denied: [false, "Check source access and restrictions; HTTP 403 alone does not prove a login problem."],
  media_unavailable: [false, "Check that the media URL is current and available."],
  unsupported_url: [false, "Check whether yt-dlp supports this source URL."],
  format_unavailable: [false, "Inspect formats with lyt info --no-download --json before choosing another quality."],
  filesystem: [false, "Check the output directory, permissions, and available disk space."],
  verification_failed: [false, "Inspect the retained output files; a download was not verified successfully."],
  size_limit: [false, "Choose a smaller format or explicitly adjust the requested size limit."],
  no_output: [false, "Inspect the source and downloader diagnostics; no final file was reported."],
  cancelled: [false, "The operation was interrupted; resume only if requested."],
  tool_output_invalid: [false, "Check tool compatibility; lyt could not read the tool's output."],
  unknown: [false, "Inspect the error message and run lyt doctor --json before retrying."],
};

export function failureKind(error) {
  if (Object.hasOwn(FAILURE_KINDS, error?.kind)) return error.kind;
  if (error?.exitCode === 2) return "usage";
  if (["ENOSPC", "EACCES", "EPERM", "EROFS"].includes(error?.code)) return "filesystem";
  if (error?.code === "ENOENT" && error?.syscall?.startsWith("spawn")) return "tool_missing";
  if (error?.name === "AbortError") return "cancelled";
  if (["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"].includes(error?.code)) return "network";
  const diagnostic = String(error?.diagnostic ?? error?.message ?? error ?? "");
  if (/auto-install of .* failed/i.test(diagnostic)) return "setup_failed";
  if (error?.exitCode === 127 || /(?:yt-dlp|ffmpeg|ffprobe).*not found/i.test(diagnostic)) return "tool_missing";
  if (/HTTP (?:Error )?429|too many requests|rate.?limit/i.test(diagnostic)) return "rate_limited";
  if (/HTTP (?:Error )?401|sign in|login required|log in|authentication required/i.test(diagnostic)) return "authentication_required";
  if (/HTTP (?:Error )?403|DRM.?protected|geo.?restricted|not available in your country/i.test(diagnostic)) return "access_denied";
  if (/HTTP (?:Error )?(?:408|5\d\d)|timed? out|network is unreachable|connection (?:reset|refused)|unable to download.*(?:webpage|JSON)/i.test(diagnostic)) return "network";
  if (/video (?:is )?(?:unavailable|removed)|private video|has been removed|HTTP (?:Error )?404/i.test(diagnostic)) return "media_unavailable";
  if (/unsupported URL|no suitable extractor/i.test(diagnostic)) return "unsupported_url";
  if (/requested format.*not available|no (?:video )?formats found/i.test(diagnostic)) return "format_unavailable";
  if (/no space left|permission denied|read-only file system/i.test(diagnostic)) return "filesystem";
  return "unknown";
}

export function taggedError(message, kind, { exitCode = 1, cause, diagnostic } = {}) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.kind = kind;
  error.exitCode = exitCode;
  if (diagnostic !== undefined) error.diagnostic = diagnostic;
  return error;
}
