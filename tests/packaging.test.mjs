import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = new URL("..", import.meta.url).pathname;
const packagesDir = join(root, "packages");

// Pi discovers package resources through conventional directories or the
// `pi` manifest key in package.json. A package without it is silently
// ignored: it installs fine but registers no tools or commands.
// (pi-context-view-lean@0.7.2-lean.0 shipped exactly this bug: installed,
// listed, but no /context command.)
test("every package declares its extension entry point via the pi key", () => {
	for (const directory of readdirSync(packagesDir)) {
		const manifest = JSON.parse(
			readFileSync(join(packagesDir, directory, "package.json"), "utf8"),
		);
		const extensions = manifest.pi?.extensions;
		assert.ok(
			Array.isArray(extensions) && extensions.includes("./index.ts"),
			`${directory}: package.json needs "pi": { "extensions": ["./index.ts"] } or pi will not load it`,
		);
	}
});
