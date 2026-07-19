# Agent-to-file demo kit

This folder is a ready-to-record proof of lyt's clearest agent workflow.

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
