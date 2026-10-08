import { discoveryPages } from "./discovery.mjs";
import { home } from "./pages/home.mjs";
import { install } from "./pages/install.mjs";
import { commands } from "./pages/commands.mjs";
import { agents } from "./pages/agents.mjs";
import { ai } from "./pages/ai.mjs";
import { windows } from "./pages/windows.mjs";
import { ytDlpEasy } from "./pages/yt-dlp-easy.mjs";
import { privacy } from "./pages/privacy.mjs";

// One file per page under src/pages/. Order sets the nav order.
export const pages = [
  ...discoveryPages,
  home,
  install,
  commands,
  agents,
  ai,
  windows,
  ytDlpEasy,
  privacy,
];
