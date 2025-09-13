// src/agent.js
import { makeClient } from "./providers.js";
import { tools } from "./tools.js";

const SYSTEM_PROMPT = `
You are a careful coding agent inside a local repository.

TOOLS (one per step):
- LIST(dir=".")                -> list files
- READ(path)                   -> read file
- WRITE(path, content)         -> overwrite file (caller may be DRY-RUN)
- GREP(pattern, dir=".")       -> literal search
- RUN(command)                 -> shell (caller may restrict)

PROTOCOL:
1) You respond with EXACTLY ONE compact JSON object per step. No markdown, no comments.
2) I will send back a message starting with "TOOL_RESULT <ACTION>:" containing the tool output.
3) After each TOOL_RESULT, you MUST return the NEXT JSON action (or DONE).

JSON EXAMPLES:
{"action":"LIST","args":{"dir":"src"}}
{"action":"READ","args":{"path":"backend/search_tools.py"}}
{"action":"WRITE","args":{"path":"x.py","content":"..."}}
{"action":"RUN","args":{"command":"pytest -q"}}
{"action":"DONE","summary":"what changed & next steps"}

Policies:
- Discover with LIST/GREP before editing.
- Always READ a file before WRITE; WRITE must include full new content.
- Keep steps small; on DONE give a brief summary.
`;

function extractJson(raw) {
  if (!raw) return null;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  try { return JSON.parse(raw); } catch {}
  const i = raw.indexOf("{"), j = raw.lastIndexOf("}");
  if (i !== -1 && j !== -1 && j > i) {
    try { return JSON.parse(raw.slice(i, j + 1)); } catch {}
  }
  return null;
}

export async function runAgent({
  task,
  model = process.env.MODEL || "qwen2.5-coder:7b",
  maxSteps = parseInt(process.env.MAX_STEPS || "20", 10),
  allowWrite = false,
  allowRun = false
}) {
  const client = makeClient();

  // Few-shot to demonstrate TOOL_RESULT pattern
  const msgs = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: "List repository root." },
    { role: "assistant", content: "{\"action\":\"LIST\",\"args\":{\"dir\":\".\"}}"},
    { role: "user", content: "TOOL_RESULT LIST:\n📄 README.md\n\nReply with ONE JSON action only (no markdown)." },
    { role: "assistant", content: "{\"action\":\"READ\",\"args\":{\"path\":\"README.md\"}}"},
    { role: "user", content: task }
  ];

  let emptyCount = 0;

  for (let step = 1; step <= maxSteps; step++) {
    const params = { model, messages: msgs, temperature: 0 };
    if (process.env.RESPONSE_FORMAT_JSON === "1") {
      params.response_format = { type: "json_object" }; // ignored if unsupported
    }

    const resp = await client.chat.completions.create(params);
    const raw = resp.choices?.[0]?.message?.content ?? "";

    if (process.env.DEBUG) {
      console.error(`\n[openhoud][step ${step}] RAW:\n${raw.slice(0, 400)}\n`);
    }

    if (!raw.trim()) {
      emptyCount++;
      msgs.push({ role: "user", content: "Empty output. Reply with ONE JSON action per the spec (no markdown)." });
      if (emptyCount >= 3) {
        return { done: false, summary: "Stalled with empty outputs." };
      }
      continue;
    }
    emptyCount = 0;

    const cmd = extractJson(raw);
    if (!cmd || typeof cmd !== "object" || !cmd.action) {
      msgs.push({ role: "user", content: "Invalid output. Reply with EXACTLY ONE JSON object per the spec." });
      continue;
    }

    if (cmd.action === "DONE") {
      return { steps: step - 1, done: true, summary: cmd.summary || "(no summary)" };
    }

    try {
      let result;
      const a = cmd.action;
      const x = cmd.args || {};
      if (a === "LIST") result = await tools.LIST(x.dir || ".");
      else if (a === "READ") result = await tools.READ(x.path);
      else if (a === "WRITE") result = await tools.WRITE(x.path, x.content ?? "", { allowWrite });
      else if (a === "GREP") result = await tools.GREP(x.pattern ?? "", x.dir || ".");
      else if (a === "RUN") result = await tools.RUN(x.command ?? "", { allowRun });
      else result = `Unknown action: ${a}`;

      const clipped = String(result);
      const body = clipped.length > 8000 ? clipped.slice(0, 8000) + "\n...[truncated]" : clipped;

      // 🔧 KEY CHANGE: feed tool result back as a USER message, not assistant.
      msgs.push({
        role: "user",
        content: `TOOL_RESULT ${a}:\n${body}\n\nReply with ONE JSON action only (no markdown).`
      });
    } catch (err) {
      msgs.push({
        role: "user",
        content: `TOOL_RESULT ${cmd.action} ERROR:\n${String(err?.message || err)}\n\nChoose the next action as ONE JSON object.`
      });
    }
  }

  return { done: false, summary: "Max steps reached." };
}
