#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const generator = path.join(root, "tools", "create-slu-game.mjs");
const certifier = path.join(root, "tools", "slu-certify.mjs");
const distPackage = root;
const renderers = ["three", "babylon", "phaser", "canvas2d", "dom", "pixi"];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function linkOrCopy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.symlinkSync(source, target, process.platform === "win32" ? "junction" : "dir");
  } catch {
    fs.cpSync(source, target, { recursive: true });
  }
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "slu-consumer-check-"));

try {
  for (const renderer of renderers) {
    const out = path.join(tempRoot, `consumer-${renderer}`);

    run(process.execPath, [
      generator,
      "--id", `consumer-${renderer}`,
      "--name", `Consumer ${renderer}`,
      "--renderer", renderer,
      "--frames", renderer === "three" ? "arcade,vehicle" : renderer === "pixi" ? "survivor" : "arcade",
      "--out", out
    ]);

    for (const file of ["AGENTS.md", "CLAUDE.md"]) {
      if (!fs.existsSync(path.join(out, file))) { console.error(`FAIL consumer ${renderer}: missing ${file}`); process.exit(1); }
    }
    if (!fs.readFileSync(path.join(out, "CLAUDE.md"), "utf8").includes("@AGENTS.md")) { console.error(`FAIL consumer ${renderer}: CLAUDE.md does not import AGENTS.md`); process.exit(1); }
    if (!fs.readFileSync(path.join(out, "AGENTS.md"), "utf8").includes("## Integration Contract")) { console.error(`FAIL consumer ${renderer}: AGENTS.md lacks Integration Contract`); process.exit(1); }

    const nodeModules = path.join(out, "node_modules");
    const scopeDir = path.join(nodeModules, "@slu");
    fs.mkdirSync(scopeDir, { recursive: true });

    const linkTarget = path.join(scopeDir, "web-shell");
    try {
      fs.symlinkSync(distPackage, linkTarget, process.platform === "win32" ? "junction" : "dir");
    } catch {
      fs.cpSync(distPackage, linkTarget, {
        recursive: true,
        filter: (src) =>
          !src.includes(`${path.sep}node_modules${path.sep}`) &&
          !src.includes(`${path.sep}.git${path.sep}`)
      });
    }

    // The generated Three.js target has renderer-specific imports. Link the shell's
    // verification-only dev dependencies so this remains a no-network consumer test.
    if (renderer === "three") {
      linkOrCopy(path.join(root, "node_modules", "three"), path.join(nodeModules, "three"));
      linkOrCopy(path.join(root, "node_modules", "@types", "three"), path.join(nodeModules, "@types", "three"));
      linkOrCopy(path.join(root, "node_modules", "vite"), path.join(nodeModules, "vite"));
      for (const f of ["src/look/startLookScene.ts", "vite.config.ts", "tuning/.gitkeep"]) if (!fs.existsSync(path.join(out, f))) { console.error(`FAIL consumer three: missing ${f}`); process.exit(1); }
    }

    // Use the shell repository's compiler so consumer verification adds no new install step.
    run("tsc", ["-p", path.join(out, "tsconfig.json"), "--noEmit"], { cwd: out });
    if (renderer === "three") {
      // Real production build of the Look starter, with a canon preset that must be bundled.
      fs.writeFileSync(path.join(out, "tuning", "look.post.json"), JSON.stringify({ schema: 1, group: "look.post", values: { bloomStrength: 1.337 } }));
      run(process.execPath, [path.join(root, "node_modules", "vite", "bin", "vite.js"), "build", "--logLevel", "warn"], { cwd: out });
      const assets = path.join(out, "dist", "assets");
      const bundle = fs.readdirSync(assets).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(assets, f), "utf8")).join("\n");
      if (!bundle.includes("1.337")) { console.error("FAIL consumer three: tuning canon not bundled"); process.exit(1); }
      if (bundle.includes("slu-tune-css")) { console.error("FAIL consumer three: tuning panel leaked into production build"); process.exit(1); }
      console.log("PASS consumer three: vite build, tuning canon bundled, panel tree-shaken");
    }
    // Generated games must also satisfy their own release metadata/capability contract.
    run(process.execPath, [certifier, "release"], { cwd: out });

    console.log(`PASS consumer + release certification: ${renderer}`);
  }

  console.log(`Consumer verification complete: ${renderers.length}/${renderers.length} targets compiled and release-certified.`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
