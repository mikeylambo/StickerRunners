#!/usr/bin/env node
// Simulates a git-tag install: packs the repo exactly as npm would fetch it, installs the
// tarball into a clean project with --ignore-scripts (no TypeScript, no build), imports every
// subpath export at runtime and typechecks a consumer that imports every subpath.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32", ...opts });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); console.error(`FAIL git-install: ${cmd} ${args.join(" ")}`); process.exit(1); }
  return r.stdout;
};
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "slu-git-install-"));
try {
  const packed = JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", temp], { cwd: root }))[0];
  const tarball = path.join(temp, packed.filename);
  const app = path.join(temp, "app");
  fs.mkdirSync(app);
  fs.writeFileSync(path.join(app, "package.json"), JSON.stringify({ name: "git-install-probe", private: true, type: "module" }));
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--offline", tarball], { cwd: app });
  // Optional peers come from the shell's dev install so the probe stays offline.
  for (const dep of ["three", "@types/three"]) {
    const target = path.join(app, "node_modules", dep);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.symlinkSync(path.join(root, "node_modules", dep), target, "dir");
  }
  const subpaths = Object.keys(pkg.exports).filter((k) => !k.includes("*"));
  const specifiers = subpaths.map((s) => (s === "." ? pkg.name : `${pkg.name}/${s.slice(2)}`));
  const runtime = specifiers.filter((s) => !s.endsWith("/look/vite"));
  fs.writeFileSync(path.join(app, "probe.mjs"),
    `${runtime.map((s, i) => `import * as m${i} from "${s}";`).join("\n")}\n` +
    `const counts = [${runtime.map((_, i) => `Object.keys(m${i}).length`).join(",")}];\n` +
    `if (counts.some((n) => n === 0)) { console.error("empty subpath", counts); process.exit(1); }\n`);
  run(process.execPath, ["probe.mjs"], { cwd: app });
  fs.writeFileSync(path.join(app, "probe.ts"), specifiers.map((s, i) => `import * as t${i} from "${s}";\nvoid t${i};`).join("\n") + "\n");
  fs.writeFileSync(path.join(app, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "Bundler", lib: ["ES2022", "DOM", "DOM.Iterable"], strict: true, skipLibCheck: true, noEmit: true, types: [] },
    files: ["probe.ts"]
  }));
  run(process.execPath, [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"], { cwd: app });
  console.log(`PASS git-install: ${packed.filename} (${packed.entryCount} files) installs without build; ${specifiers.length} subpaths import + typecheck`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
