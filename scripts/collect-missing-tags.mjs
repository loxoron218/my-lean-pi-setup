// collect-missing-tags: list `<name>@<version>` release tags that still need
// pushing. The auto-tag workflow pushes each listed tag, which fires
// publish.yml. Pure functions are imported by tests; the CLI wrapper below
// runs when the file is executed directly.
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Every lean package keeps `version` equal to its upstream pin (a `-lean.N`
// suffix is allowed for republish-only changes), so the release tag for a
// manifest is always `<name>@<version>`.
export function releaseTag(name, version) {
	return `${name}@${version}`;
}

export async function readPackageManifests(packagesDir) {
	const entries = await readdir(packagesDir, { withFileTypes: true });
	const manifests = [];
	for (const entry of entries.filter((item) => item.isDirectory()).map((item) => item.name).sort()) {
		const manifest = JSON.parse(await readFile(path.join(packagesDir, entry, "package.json"), "utf8"));
		manifests.push({ name: manifest.name, version: manifest.version });
	}
	return manifests;
}

// True when the exact version is already on the registry (published by hand
// without a git tag). Tagging it would fire publish.yml just to fail on the
// existing version, so those are skipped, not backfilled.
export function defaultIsPublished(name, version) {
	try {
		execFileSync("npm", ["view", `${name}@${version}`, "version"], { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

// Existing tags are never moved: anything already tagged is skipped, even if
// it points elsewhere.
export async function collectMissingTags(manifests, existingTags, isPublished = defaultIsPublished) {
	const known = new Set(existingTags);
	const missing = [];
	for (const { name, version } of manifests) {
		const tag = releaseTag(name, version);
		if (known.has(tag)) continue;
		if (await isPublished(name, version)) continue;
		missing.push(tag);
	}
	return missing;
}

const isMain =
	typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
	const setupRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
	const existing = execFileSync("git", ["tag", "--list"], { cwd: setupRoot, encoding: "utf8" })
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	const manifests = await readPackageManifests(path.join(setupRoot, "packages"));
	for (const tag of await collectMissingTags(manifests, existing)) console.log(tag);
}
