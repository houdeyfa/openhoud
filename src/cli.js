#!/usr/bin/env node
import fs from "fs";
import { runAgent } from "./agent.js";
import { runPipeline } from "./pipeline.js";

function readStdinSyncIfPiped() {
  if (process.stdin.isTTY) return "";
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith("--")));
  const allowWrite = flags.has("--write");
  const allowRun = flags.has("--run");
  const usePipeline = flags.has("--pipeline");

  const taskArg = args.filter(a => !a.startsWith("--")).join(" ");
  const piped = readStdinSyncIfPiped();
  const task = (taskArg || piped).trim();

  if (!task) {
    console.error(
      "Usage: openhoud \"Your task\" [--write] [--run] [--pipeline]\n" +
      "Example:\n" +
      "  PROVIDER=ollama MODEL=qwen2.5-coder:7b openhoud \"List repo and READ backend/search_tools.py\""
    );
    process.exit(1);
  }

  if (usePipeline) {
    const results = await runPipeline(task, { allowWrite, allowRun });
    console.log("\n=== PIPELINE RESULTS ===");
    results.forEach((r, i) => {
      console.log(`Step ${i + 1}: ${r.summary}`);
    });
  } else {
    const res = await runAgent({ task, allowWrite, allowRun });
    console.log("\n=== AGENT SUMMARY ===");
    console.log(res.summary);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
