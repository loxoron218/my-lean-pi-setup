import assert from "node:assert/strict";
import test from "node:test";

import { collectMissingTags, releaseTag } from "../scripts/collect-missing-tags.mjs";

const neverPublished = async () => false;

test("release tag joins name and version with @", () => {
	assert.equal(releaseTag("pi-zentui-lean", "0.33.0"), "pi-zentui-lean@0.33.0");
});

test("untagged versions are listed, tagged ones are skipped", async () => {
	const manifests = [
		{ name: "pi-context-view-lean", version: "0.8.1" },
		{ name: "pi-zentui-lean", version: "0.33.0" },
	];
	assert.deepEqual(
		await collectMissingTags(manifests, ["pi-context-view-lean@0.8.1"], neverPublished),
		["pi-zentui-lean@0.33.0"],
	);
});

test("empty result when everything is already tagged", async () => {
	const manifests = [{ name: "pi-zentui-lean", version: "0.33.0" }];
	assert.deepEqual(
		await collectMissingTags(manifests, ["pi-zentui-lean@0.33.0"], neverPublished),
		[],
	);
});

test("existing tags are never re-emitted, even for a moved version", async () => {
	const manifests = [{ name: "pi-zentui-lean", version: "0.33.0" }];
	assert.deepEqual(
		await collectMissingTags(
			manifests,
			["other-lean@1.0.0", "pi-zentui-lean@0.33.0"],
			neverPublished,
		),
		[],
	);
});

test("versions already on npm are skipped, not backfilled", async () => {
	const manifests = [
		{ name: "ponytail-lean", version: "5.3.2-lean.1" },
		{ name: "pi-zentui-lean", version: "0.33.0" },
	];
	const isPublished = async (name) => name === "ponytail-lean";
	assert.deepEqual(await collectMissingTags(manifests, [], isPublished), ["pi-zentui-lean@0.33.0"]);
});
