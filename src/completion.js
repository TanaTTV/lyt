// `lyt completion <bash|zsh|fish>` — shell tab completion built from the same
// flag list `lyt capabilities` publishes, so it cannot drift from the parser.

import process from "node:process";
import { COMMANDS, OPTIONS } from "./capabilities.js";
import { profileNames } from "./config.js";
import { usageError } from "./errors.js";
import { AUDIO_FORMATS, VIDEO_CONTAINERS } from "./ytDlp.js";

export const SHELLS = ["bash", "zsh", "fish"];
const BINS = ["lyt", "yt3", "yt4"];

function words() {
  const subcommands = COMMANDS.filter((command) => command !== "download");
  const flags = OPTIONS.map((option) => option.flag);
  const valueFlags = OPTIONS.filter((option) => option.takesValue).map((option) => option.flag);
  const choices = {
    "--profile": profileNames(),
    "--audio-format": AUDIO_FORMATS,
    "--container": VIDEO_CONTAINERS,
    "--quality": ["128K", "192K", "320K", "0", "720p", "1080p", "1440p", "4k", "best"],
    "--cookies-from-browser": ["chrome", "firefox", "edge", "safari", "brave", "chromium", "opera", "vivaldi"],
  };
  return { subcommands, flags, valueFlags, choices };
}

function bashScript() {
  const { subcommands, flags, valueFlags, choices } = words();
  const cases = Object.entries(choices)
    .map(([flag, values]) => `      ${flag}) COMPREPLY=($(compgen -W "${values.join(" ")}" -- "$cur")); return ;;`)
    .join("\n");
  return `# lyt bash completion. Install: lyt completion bash >> ~/.bashrc
_lyt_complete() {
  local cur prev
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  case "$prev" in
${cases}
      -o|--output-dir|-a|--batch-file|--cookies) COMPREPLY=($(compgen -f -- "$cur")); return ;;
      ${valueFlags.filter((flag) => !Object.hasOwn(choices, flag) && !["--output-dir", "--batch-file", "--cookies"].includes(flag)).join("|")}) return ;;
  esac
  if [[ $COMP_CWORD -eq 1 && "$cur" != -* ]]; then
    COMPREPLY=($(compgen -W "${subcommands.join(" ")}" -- "$cur"))
    return
  fi
  COMPREPLY=($(compgen -W "${flags.join(" ")} --help --version" -- "$cur"))
}
complete -F _lyt_complete ${BINS.join(" ")}
`;
}

function zshScript() {
  // zsh can load bash completions; this keeps one implementation.
  return `# lyt zsh completion. Install: lyt completion zsh >> ~/.zshrc
autoload -Uz bashcompinit && bashcompinit
${bashScript()}`;
}

function fishScript() {
  const { subcommands, choices } = words();
  const lines = [
    "# lyt fish completion. Install: lyt completion fish > ~/.config/fish/completions/lyt.fish",
  ];
  for (const bin of BINS) {
    lines.push(`complete -c ${bin} -n "__fish_use_subcommand" -a "${subcommands.join(" ")}"`);
    for (const option of OPTIONS) {
      const name = option.flag.replace(/^--/, "");
      const values = choices[option.flag];
      const value = values ? ` -x -a "${values.join(" ")}"` : option.takesValue ? " -r" : "";
      const summary = option.summary.replaceAll("\"", "'");
      lines.push(`complete -c ${bin} -l ${name}${value} -d "${summary}"`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function completionScript(shell) {
  const name = String(shell ?? "").trim().toLowerCase();
  if (name === "bash") return bashScript();
  if (name === "zsh") return zshScript();
  if (name === "fish") return fishScript();
  throw usageError(`Usage: lyt completion <${SHELLS.join("|")}>`);
}

export function runCompletionCommand(argv, { log = (text) => process.stdout.write(text) } = {}) {
  log(completionScript(argv[0]));
}
