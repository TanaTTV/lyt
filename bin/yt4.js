#!/usr/bin/env node

// yt4: video download shortcut.
import { run } from "../src/cli.js";

run(process.argv.slice(2), { video: true });
