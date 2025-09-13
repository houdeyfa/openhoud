// src/pipeline.js
import { runAgent } from "./agent.js";

/**
 * Planner agent that turns a high level task into a list of
 * structured steps. Each step is assigned to one of the
 * specialised agents: "writer", "reader", "docs" or "chat".
 */
export async function planAgent(task, opts = {}) {
  const planningPrompt = `You are a planning agent that designs a pipeline for other agents.\n` +
    `Return a JSON array of steps. Each step is an object with:\n` +
    `  - \"agent\": one of \"writer\", \"reader\", \"docs\", \"chat\"\n` +
    `  - \"task\": instruction for that agent.\n` +
    `No additional text. Only valid JSON.\n\nUser task: ${task}`;

  const res = await runAgent({ task: planningPrompt, ...opts });

  try {
    // The planner is expected to return the JSON array in the summary
    return JSON.parse(res.summary);
  } catch {
    return [];
  }
}

/**
 * Execute a multi-agent pipeline by first planning and then dispatching
 * each step to the appropriate specialised agent. Each specialised
 * agent reuses the existing runAgent function with different
 * permissions.
 */
export async function runPipeline(task, opts = {}) {
  const steps = await planAgent(task, opts);
  const results = [];

  for (const step of steps) {
    const { agent, task: subTask } = step || {};
    if (!agent || !subTask) {
      results.push({ done: false, summary: "Invalid step" });
      continue;
    }

    if (agent === "writer") {
      results.push(await runAgent({ task: subTask, allowWrite: true, allowRun: opts.allowRun }));
    } else if (agent === "reader" || agent === "docs" || agent === "chat") {
      results.push(await runAgent({ task: subTask, allowRun: opts.allowRun }));
    } else {
      results.push({ done: false, summary: `Unknown agent: ${agent}` });
    }
  }

  return results;
}

