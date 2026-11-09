#!/usr/bin/env node
// npm run release -- <major|minor|patch|X.Y.Z> [--no-push] [--skip-verify]
// Promotes "## Unreleased" in CHANGELOG to the new version, syncs package.json + README header,
// rebuilds dist (committed so git-tag installs need no build), verifies, commits, tags vX.Y.Z, pushes.
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const bump = args.find((a) => !a.startsWith("--")) ?? "patch";
const sh = (cmd, a) => { const r = spawnSync(cmd, a, { stdio: "inherit", shell: process.platform === "win32" }); if (r.status !== 0) process.exit(r.status ?? 1); };
const out = (cmd, a) => spawnSync(cmd, a, { encoding: "utf8" }).stdout.trim();

if (out("git", ["status", "--porcelain", "--untracked-files=no"])) { console.error("release: working tree has uncommitted changes"); process.exit(1); }
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const [maj, min, pat] = pkg.version.split(".").map(Number);
const next = /^\d+\.\d+\.\d+$/.test(bump) ? bump
  : bump === "major" ? `${maj + 1}.0.0` : bump === "minor" ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;

if (next !== pkg.version) {
  pkg.version = next;
  fs.writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  const readme = fs.readFileSync("README.md", "utf8").split("\n");
  readme[0] = `# SLU Web Shell ${next}`;
  fs.writeFileSync("README.md", readme.join("\n"));
  let log = fs.readFileSync("CHANGELOG.md", "utf8");
  log = /^## Unreleased/m.test(log) ? log.replace(/^## Unreleased/m, `## ${next}`) : log.replace(/^## /m, `## ${next}\n\n- Maintenance release.\n\n## `);
  fs.writeFileSync("CHANGELOG.md", log);
}
if (!args.includes("--skip-verify")) sh("npm", ["run", "verify"]);
else sh("npm", ["run", "build"]);
sh("git", ["add", "-A", "package.json", "README.md", "CHANGELOG.md", "dist"]);
if (out("git", ["diff", "--cached", "--name-only"])) sh("git", ["commit", "-m", `Release v${next}`]);
sh("git", ["tag", "-a", `v${next}`, "-m", `SLU Web Shell v${next}`]);
if (!args.includes("--no-push")) { sh("git", ["push"]); sh("git", ["push", "origin", `v${next}`]); }
console.log(`Released v${next}. Games install: "@slu/web-shell": "github:mikeylambo/Web-Game-Shell-v1.02#v${next}"`);
