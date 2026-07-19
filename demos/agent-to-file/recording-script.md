# 30-second recording script

The demo should prove one thing: an agent can turn a plain request into a safe
local file and return the exact final path.

| Time | Screen | Narration or caption |
| --- | --- | --- |
| 0-4s | Codex or Claude Code with `prompt.txt` pasted | "Give your agent one permitted media URL." |
| 4-10s | Agent checks `lyt --version` and selects JSON mode | "lyt gives agents a small, predictable command surface." |
| 10-22s | `lyt --video --max-filesize 2G --json "URL"` runs | "Safe defaults keep playlists off and cap the file size." |
| 22-28s | Agent reads `results[].files` | "No terminal scraping. The result includes the exact final path." |
| 28-30s | File Explorer opens the saved file | "Local file. Done." |

Recording notes:

- Use media you own or have written permission to download.
- Keep the terminal at 120% zoom and crop out unrelated files or accounts.
- Use a 10-20 second source clip so the real download finishes quickly.
- Show the real command and result; do not mock the output.
- End on `npm install -g @tanattv/lyt` and `github.com/TanaTTV/lyt`.
