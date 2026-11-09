#!/usr/bin/env node
// Fails if package.json, README header and the top CHANGELOG entry disagree on the version.
import fs from "node:fs";
const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const readme = fs.readFileSync("README.md", "utf8").split("\n")[0];
const changelog = fs.readFileSync("CHANGELOG.md", "utf8").match(/^## (\d+\.\d+\.\d+)/m)?.[1];
const problems = [];
if (readme.trim() !== `# SLU Web Shell ${version}`) problems.push(`README header "${readme}" != "# SLU Web Shell ${version}"`);
if (changelog !== version) problems.push(`CHANGELOG top entry ${changelog} != ${version}`);
if (!fs.existsSync("dist/index.js")) problems.push("dist/ is missing; git-tag installs need committed dist");
if (problems.length) { console.error(problems.map((p) => `FAIL version: ${p}`).join("\n")); process.exit(1); }
console.log(`PASS version: ${version} consistent across package.json, README, CHANGELOG`);
