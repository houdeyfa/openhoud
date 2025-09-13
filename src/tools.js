// Very small toolset. All paths are confined to CWD for safety.

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const norm = p => path.resolve(ROOT, p);

function assertInsideRoot(absPath) {
  if (!absPath.startsWith(ROOT)) {
    throw new Error(`Refusing to access outside project root: ${absPath}`);
  }
}

export const tools = {
  LIST: async (dir = ".") => {
    const abs = norm(dir);
    assertInsideRoot(abs);
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    return entries
      .map(d => `${d.isDirectory() ? "📁" : "📄"} ${path.join(dir, d.name)}`)
      .join("\n");
  },

  READ: async (file) => {
    const abs = norm(file);
    assertInsideRoot(abs);
    return fs.readFileSync(abs, "utf8");
  },

  WRITE: async (file, content, { allowWrite }) => {
    if (!allowWrite) return `DRY-RUN: Would write ${file} (run with --write to enable).`;
    const abs = norm(file);
    assertInsideRoot(abs);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    // backup
    if (fs.existsSync(abs)) fs.copyFileSync(abs, abs + ".bak");
    fs.writeFileSync(abs, content, "utf8");
    return `WROTE ${file} (${content.length} bytes). Backup: ${file}.bak (if existed).`;
  },

  GREP: async (pattern, dir = ".") => {
    // Simple recursive text search (UTF-8)
    const out = [];
    function walk(d) {
      for (const name of fs.readdirSync(d)) {
        const p = path.join(d, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else if (st.isFile()) {
          const txt = fs.readFileSync(p, "utf8");
          if (txt.includes(pattern)) {
            out.push(p.replace(ROOT + path.sep, ""));
          }
        }
      }
    }
    walk(norm(dir));
    return out.join("\n") || "(no matches)";
  },

  RUN: async (cmd, { allowRun }) => {
    if (!allowRun) return `DRY-RUN: Would run '${cmd}' (use --run to enable).`;
    const res = execSync(cmd, { cwd: ROOT, encoding: "utf8" });
    // Truncate very long outputs
    return res.length > 5000 ? res.slice(0, 5000) + "\n...[truncated]" : res;
  }
};
