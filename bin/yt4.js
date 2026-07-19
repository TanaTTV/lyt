#!/usr/bin/env node

// yt4: video download shortcut.
import { runEntry } from "../src/entry.js";

runEntry(process.argv.slice(2), { video: true });
