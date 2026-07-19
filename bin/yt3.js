#!/usr/bin/env node

// yt3: native-audio download shortcut.
import { runEntry } from "../src/entry.js";

runEntry(process.argv.slice(2), { video: false });
