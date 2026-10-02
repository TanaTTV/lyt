// Help/version avoid importing the download engine on simple discovery calls.
import { loadConfig } from "../config.js";
import { usage } from "../ytDlp.js";
import { VERSION } from "../version.js";
import { isUpdateCheckEnabled, maybeNotifyUpdate } from "../updateCheck.js";

export async function runMetaCommand(flag, config = loadConfig()) {
  if (flag === "--help" || flag === "-h") {
    console.log(usage());
    return;
  }
  console.log(`lyt ${VERSION}`);
  if (isUpdateCheckEnabled(config)) {
    await maybeNotifyUpdate({ enabled: true });
  }
}
