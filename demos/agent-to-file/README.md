# Agent-to-file demo kit

This folder contains the finished launch video workflow and everything needed
to reproduce or re-record it.

## Fast path

1. Install the CLI and marketplace plugin from the root README.
2. Replace `URL` in `prompt.txt` with a short permitted media URL.
3. Paste the prompt into Codex or Claude Code.
4. Follow `recording-script.md` and capture the real result.

To verify the same flow directly in PowerShell:

```powershell
.\demos\agent-to-file\demo.ps1 -Url "URL" -IHavePermission
```

Choose a separate output directory when needed:

```powershell
.\demos\agent-to-file\demo.ps1 -Url "URL" -OutputDirectory "D:\Media" -IHavePermission
```

The permission switch is intentionally required. The script uses `--json`,
rejects unsuccessful results, and prints paths reported by `results[].files`.

## Rebuild the launch video

`real-run.json` contains the successful result captured from the original,
MIT-licensed source clip in `website/public/demo`. Rebuild the branded video
and poster with:

```powershell
.\demos\agent-to-file\build-demo.ps1
```

Once published, the launch video is available at:

<https://tanattv.github.io/lyt/demo/lyt-agent-demo.mp4>
