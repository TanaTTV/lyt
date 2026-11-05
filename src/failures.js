// Stable machine-readable failure categories. Exit codes remain unchanged;
// `kind`, `retryable`, and `suggestion` are additive fields on error objects.

export const FAILURE_KINDS = {
  usage: [false, "Check the command arguments with lyt --help or lyt capabilities --json."],
  tool_missing: [false, "Run lyt doctor --json; authorize tool setup separately if needed."],
  tool_unavailable: [false, "The installed tool did not pass its startup check; inspect access and diagnostics before authorizing repair."],
  setup_failed: [false, "Run lyt doctor --json and resolve the reported tool setup failure."],
  tool_outdated: [true, "yt-dlp is likely out of date for this site. Run lyt doctor --update, then retry once."],
  bot_check: [true, "The site asked for a bot check. Run lyt doctor --update and retry later; for media your own account can access, the user may opt in to --cookies-from-browser."],
  network: [true, "Check connectivity and retry with a bounded retry policy."],
  rate_limited: [true, "Wait before retrying; use -j 1 and --polite to space out requests."],
  authentication_required: [false, "The media needs a signed-in account. Use --cookies-from-browser only when the user explicitly opts in for media their account can access."],
  age_restricted: [false, "The media is age-restricted. It needs a signed-in account; use --cookies-from-browser only when the user explicitly opts in."],
  members_only: [false, "The media is limited to channel members or purchasers; lyt does not bypass access controls."],
  drm_protected: [false, "The media is DRM-protected; lyt does not bypass DRM."],
  geo_restricted: [false, "The media is not available in this region; lyt does not bypass regional restrictions."],
  access_denied: [false, "Check source access and restrictions; HTTP 403 alone does not prove a login problem. Try lyt doctor --update first."],
  live_not_started: [true, "The live stream or premiere has not started; retry after it begins, or add --wait to wait for it."],
  media_unavailable: [false, "Check that the media URL is current and available."],
  unsupported_url: [false, "Check whether yt-dlp supports this source URL."],
  format_unavailable: [false, "Inspect formats with lyt info --no-download --json (or lyt -L) before choosing another quality."],
  filesystem: [false, "Check the output directory, permissions, and available disk space."],
  verification_failed: [false, "Inspect the retained output files; a download was not verified successfully."],
  size_limit: [false, "Choose a smaller format or explicitly adjust the requested size limit."],
  no_output: [false, "Inspect the source and downloader diagnostics; no final file was reported."],
  cancelled: [false, "The operation was interrupted; resume only if requested."],
  tool_output_invalid: [false, "Check tool compatibility; lyt could not read the tool's output."],
  unknown: [false, "Inspect the error message and run lyt doctor --json before retrying."],
};

// Ordered: more specific patterns first.
const PATTERNS = [
  ["setup_failed", /auto-install of .* failed/i],
  ["bot_check", /confirm (?:you(?:'|’)re|you are) not a bot/i],
  ["age_restricted", /age[- ]restricted|confirm your age|inappropriate for some users/i],
  ["members_only", /members[- ]only|join this channel|available to this channel's members|requires payment/i],
  ["drm_protected", /DRM.?protected|is DRM/i],
  ["geo_restricted", /geo.?restrict|not available in your country|not made this video available in your country/i],
  ["live_not_started", /premieres in|live event will begin|this live event has not started|is_upcoming|will begin in/i],
  ["tool_outdated", /nsig extraction failed|unable to extract (?:uploader|initial|player|yt ?initial)|signature extraction failed|please report this issue on|confirm you are on the latest version/i],
  ["rate_limited", /HTTP (?:Error )?429|too many requests|rate.?limit/i],
  ["authentication_required", /HTTP (?:Error )?401|login required|log in|authentication required|use --cookies|private video/i],
  ["access_denied", /HTTP (?:Error )?403|forbidden/i],
  ["network", /HTTP (?:Error )?(?:408|5\d\d)|timed? ?out|network is unreachable|connection (?:reset|refused)|unable to connect|name resolution|getaddrinfo|unable to download.*(?:webpage|JSON|API)/i],
  ["media_unavailable", /video (?:is )?(?:unavailable|removed)|has been removed|terminated|HTTP (?:Error )?404|does not exist/i],
  ["unsupported_url", /unsupported URL|no suitable extractor/i],
  ["format_unavailable", /requested format.*not available|no (?:video )?formats found/i],
  ["filesystem", /no space left|permission denied|read-only file system/i],
];

export function failureKind(error) {
  if (Object.hasOwn(FAILURE_KINDS, error?.kind)) return error.kind;
  if (error?.exitCode === 2) return "usage";
  if (["ENOSPC", "EACCES", "EPERM", "EROFS"].includes(error?.code)) return "filesystem";
  if (error?.code === "ENOENT" && error?.syscall?.startsWith("spawn")) return "tool_missing";
  if (error?.name === "AbortError") return "cancelled";
  if (["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"].includes(error?.code)) return "network";
  const diagnostic = String(error?.diagnostic ?? error?.message ?? error ?? "");
  if (error?.exitCode === 127 || /(?:yt-dlp|ffmpeg|ffprobe)[^\n]*not found/i.test(diagnostic)) {
    return "tool_missing";
  }
  // A failed signature/nsig step means formats are missing because yt-dlp is
  // behind the site, whatever the final error line says.
  if (/nsig extraction failed|signature extraction failed|unable to extract (?:player|nsig|signature)/i.test(diagnostic)) {
    return "tool_outdated";
  }
  // The first ERROR line names the real cause; earlier lines are progress noise.
  const primary = errorLine(diagnostic) ?? diagnostic;
  for (const [kind, pattern] of PATTERNS) {
    if (pattern.test(primary)) return kind;
  }
  for (const [kind, pattern] of PATTERNS) {
    if (pattern.test(diagnostic)) return kind;
  }
  return "unknown";
}

// The most useful single line from tool output: the last "ERROR:" line,
// with yt-dlp's generic bug-report boilerplate removed.
export function errorLine(text) {
  const lines = String(text ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const errors = lines.filter((line) => /^ERROR:/i.test(line));
  const chosen = errors.at(-1);
  if (!chosen) return null;
  return chosen
    .replace(/;\s*please report this issue on\s+https?:\/\/\S+.*$/i, "")
    .replace(/\s+Confirm you are on the latest version using\s+.*$/i, "")
    .replace(/\s*\(caused by [^)]*\)+/i, "")
    .trim();
}

// A short message for people and agents; full tool output stays in `diagnostic`.
export function summarizeToolFailure(prefix, diagnostic) {
  const line = errorLine(diagnostic);
  return line ? `${prefix}: ${line.replace(/^ERROR:\s*/i, "")}` : prefix;
}

export function taggedError(message, kind, { exitCode = 1, cause, diagnostic } = {}) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.kind = kind;
  error.exitCode = exitCode;
  if (diagnostic !== undefined) error.diagnostic = diagnostic;
  return error;
}

// Bounded tail of tool output for JSON consumers.
export function diagnosticTail(text, maxLines = 12, maxChars = 2000) {
  const lines = String(text ?? "").split(/\r?\n/).filter((line) => line.trim() !== "");
  const tail = lines.slice(-maxLines).join("\n");
  return tail.length > maxChars ? tail.slice(tail.length - maxChars) : tail;
}
