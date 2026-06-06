#!/usr/bin/env node

// yt3: audio download shortcut.
import { run } from "../src/cli.js";

run(process.argv.slice(2), { video: false });
