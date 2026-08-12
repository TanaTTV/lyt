// `lyt config` — persistent user defaults.

import {
  assertConfigKey,
  configPath,
  loadConfig,
  saveConfig,
} from "../config.js";
import { usageError } from "../errors.js";

export function runConfigCommand(argv) {
  const [action, key, ...rest] = argv;
  const config = loadConfig();

  switch (action) {
    case "set": {
      if (!key || rest.length === 0) {
        throw usageError("Usage: lyt config set <key> <value>");
      }

      assertConfigKey(key);
      config[key] = rest.join(" ");
      saveConfig(config);
      console.log(`${key} = ${config[key]}`);
      return;
    }

    case "get": {
      if (!key) {
        throw usageError("Usage: lyt config get <key>");
      }

      assertConfigKey(key);
      console.log(config[key] !== undefined ? `${key} = ${config[key]}` : `${key} is not set`);
      return;
    }

    case "unset": {
      if (!key) {
        throw usageError("Usage: lyt config unset <key>");
      }

      assertConfigKey(key);
      delete config[key];
      saveConfig(config);
      console.log(`${key} unset`);
      return;
    }

    case "list":
    case undefined: {
      const keys = Object.keys(config);

      if (keys.length === 0) {
        console.log("No config values set. Try: lyt config set quality 320K");
      } else {
        for (const k of keys.sort()) {
          console.log(`${k} = ${config[k]}`);
        }
      }

      console.log(`(config file: ${configPath()})`);
      return;
    }

    case "path": {
      console.log(configPath());
      return;
    }

    default:
      throw usageError(
        `Unknown config action: ${action}. Use set, get, unset, list, or path.`,
      );
  }
}
