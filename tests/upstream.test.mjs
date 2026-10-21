import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { UPSTREAMS, bumpManifestText, collectStatus, renderReport } from "../scripts/check-upstream.mjs";

const setupRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("daily sync tracks every package directory exactly once", async () => {
	const entries = await readdir(path.join(setupRoot, "packages"), { withFileTypes: true });
	const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
	assert.deepEqual(
		UPSTREAMS.map((entry) => entry.directory).sort(),
		directories,
	);
});

test("pins are exact and each lean version matches its pin", async () => {
	for (const { directory, upstream, field } of UPSTREAMS) {
		const manifest = JSON.parse(
			await readFile(path.join(setupRoot, "packages", directory, "package.json"), "utf8"),
		);
		const pinned = manifest[field]?.[upstream];
		assert.match(pinned, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, `${directory}: pin must be exact`);
		assert.equal(manifest.version, pinned, `${directory}: version must equal the pin`);
	}
});

test("report renders one line per tracked package", async () => {
	const rows = await collectStatus(async (specifier) => `0.0.0-${specifier.replace(/[^a-z]/gi, "")}`);
	const report = renderReport(rows);
	for (const row of rows) {
		assert.ok(report.includes(row.directory));
		assert.ok(report.includes("BEHIND"));
	}
});

test("bump only touches the version and pin strings, preserving formatting", () => {
	const singleLine =
		'{"name": "pi-zentui-lean", "version": "0.32.0", "dependencies": {"pi-zentui": "0.32.0"}}';
	const pretty = '{\n  "name": "pi-zentui-lean",\n  "version": "0.32.0",\n  "dependencies": {\n    "pi-zentui": "0.32.0"\n  }\n}';
	const row = {
		directory: "pi-zentui-lean",
		upstream: "pi-zentui",
		pinned: "0.32.0",
		latest: "0.99.0",
	};

	assert.equal(
		bumpManifestText(singleLine, row),
		'{"name": "pi-zentui-lean", "version": "0.99.0", "dependencies": {"pi-zentui": "0.99.0"}}',
	);
	assert.equal(
		bumpManifestText(pretty, row),
		'{\n  "name": "pi-zentui-lean",\n  "version": "0.99.0",\n  "dependencies": {\n    "pi-zentui": "0.99.0"\n  }\n}',
	);
	// A missing or ambiguous pin fails loudly instead of half-editing.
	assert.throws(() => bumpManifestText('{"version": "1.0.0"}', row));
	assert.throws(() =>
		bumpManifestText('{"version": "0.32.0", "other": "0.32.0"}', { ...row, upstream: "missing" }),
	);
});
