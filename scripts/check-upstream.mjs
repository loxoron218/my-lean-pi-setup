// Daily upstream tracker for the lean wrappers.
//
// Each lean package pins its upstream extension to an exact version and keeps
// its own `version` on that pin: either exactly equal (`0.7.2`) or the pin
// plus a `-lean.N` publish suffix (`0.7.2-lean.0`). The suffix exists only
// because npm permanently reserves version numbers that were published and
// then unpublished; fresh pins always publish (and sync) as plain numbers.
// This script is the single source of truth for that mapping (see UPSTREAMS) and is run once per day by
// `.github/workflows/upstream-sync.yml`.
//
//   node scripts/check-upstream.mjs report [--json]  # human table (default) or JSON
//   node scripts/check-upstream.mjs check            # report; exit 1 when a pin fell behind
//   node scripts/check-upstream.mjs apply            # bump version + pin in package.json (no install)
//
// `apply` only edits the two version strings in place so each package keeps
// its own package.json formatting. The caller is responsible for running
// `npm install --prefix packages/<dir>` afterwards to refresh the lockfile
// and node_modules (that step is what actually fetches the upstream code),
// then `npm run check --prefix packages/<dir>`. A failing check after a bump
// is expected when upstream changed commands/tools/descriptions: the lean
// adapter needs a manual sync per the package's MAINTENANCE.md.
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const setupRoot = path.dirname(scriptDir);

// Lean directory -> upstream npm specifier + which package.json field holds
// the pin. pi-system-prompt-lean tracks Pi itself, so its upstream lives in
// devDependencies; everything else pins via dependencies.
// Adding a package: append one row here (and to the CI matrix in check.yml).
export const UPSTREAMS = [
	{ directory: "pi-context-view-lean", upstream: "pi-context-view", field: "dependencies" },
	{ directory: "pi-deep-research-lean", upstream: "pi-deep-research", field: "dependencies" },
	{ directory: "pi-permission-system-lean", upstream: "@gotgenes/pi-permission-system", field: "dependencies" },
	{ directory: "pi-plan-mode-lean", upstream: "@narumitw/pi-plan-mode", field: "dependencies" },
	{ directory: "pi-system-prompt-lean", upstream: "@earendil-works/pi-coding-agent", field: "devDependencies" },
	{ directory: "pi-usage-lean", upstream: "@narumitw/pi-usage", field: "dependencies" },
	{ directory: "pi-workspace-history-lean", upstream: "pi-workspace-history", field: "dependencies" },
	{ directory: "pi-zentui-lean", upstream: "pi-zentui", field: "dependencies" },
	{ directory: "ponytail-lean", upstream: "@dietrichgebert/ponytail", field: "dependencies" },
];

export function leanVersionMatches(version, pin) {
	return version === pin || new RegExp(`^${escapeRegExp(pin)}-lean\\.\\d+$`).test(version);
}

export async function getLatestVersion(specifier) {
	const { stdout } = await execFileAsync("npm", ["view", specifier, "version", "--json"], {
		timeout: 120_000,
	});
	const parsed = JSON.parse(stdout);
	if (Array.isArray(parsed)) return parsed[parsed.length - 1];
	return parsed;
}

export async function collectStatus(fetchLatest = getLatestVersion) {
	const rows = [];
	for (const entry of UPSTREAMS) {
		const manifestPath = path.join(setupRoot, "packages", entry.directory, "package.json");
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
		const pinned = manifest[entry.field]?.[entry.upstream];
		if (typeof pinned !== "string" || pinned.length === 0) {
			throw new Error(`${entry.directory}: no pinned version for ${entry.upstream} in ${entry.field}`);
		}
		const latest = await fetchLatest(entry.upstream);
		if (typeof latest !== "string" || latest.length === 0) {
			throw new Error(`registry returned no version for ${entry.upstream}`);
		}
		rows.push({
			...entry,
			leanVersion: manifest.version,
			pinned,
			latest,
			outdated: pinned !== latest,
			versionDrift: !leanVersionMatches(manifest.version, pinned),
		});
	}
	return rows;
}

export function renderReport(rows) {
	const header = ["lean package", "upstream", "pinned", "latest", "status"];
	const lines = rows.map((row) => [
		row.directory,
		row.upstream,
		row.pinned,
		row.latest,
		row.outdated ? "BEHIND" : row.versionDrift ? "DRIFT (version != pin)" : "ok",
	]);
	const widths = header.map((cell, i) => Math.max(cell.length, ...lines.map((line) => line[i].length)));
	const format = (cells) => cells.map((cell, i) => cell.padEnd(widths[i])).join("  ");
	return [format(header), ...lines.map(format)].join("\n");
}

function escapeRegExp(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceOnce(text, label, pattern, replacement) {
	const matches = text.match(new RegExp(pattern, "g")) ?? [];
	if (matches.length !== 1) {
		throw new Error(`expected exactly one ${label} match, found ${matches.length}`);
	}
	return text.replace(new RegExp(pattern), replacement);
}

export function bumpManifestText(raw, { directory, upstream, pinned, latest }) {
	// The lean version may carry a `-lean.N` publish suffix; consume it so a
	// sync bump lands on the plain new pin instead of `latest-lean.N`.
	const withVersion = replaceOnce(
		raw,
		`"version" pin in ${directory}`,
		`"version":\\s*"${escapeRegExp(pinned)}(?:-lean\\.\\d+)?"`,
		`"version": "${latest}"`,
	);
	return replaceOnce(
		withVersion,
		`"${upstream}" pin in ${directory}`,
		`"${escapeRegExp(upstream)}":\\s*"${escapeRegExp(pinned)}"`,
		`"${upstream}": "${latest}"`,
	);
}

export async function applyLatest(rows) {
	const changed = [];
	for (const row of rows.filter((row) => row.outdated)) {
		const manifestPath = path.join(setupRoot, "packages", row.directory, "package.json");
		const raw = await readFile(manifestPath, "utf8");
		await writeFile(manifestPath, bumpManifestText(raw, row), "utf8");
		changed.push(row);
	}
	return changed;
}

async function main() {
	const args = process.argv.slice(2);
	const command = args.find((arg) => !arg.startsWith("--")) ?? "report";
	const asJson = args.includes("--json");

	if (command === "apply") {
		const rows = await collectStatus();
		const changed = await applyLatest(rows);
		for (const row of changed) {
			console.log(`${row.directory}: ${row.pinned} -> ${row.latest}`);
		}
		if (changed.length === 0) console.log("All pins already match the registry.");
		else {
			console.log("\nNext: for each changed package run");
			console.log("  npm install --prefix packages/<dir>   # refresh lockfile + fetch upstream code");
			console.log("  npm run check --prefix packages/<dir>");
		}
		return;
	}

	if (command !== "report" && command !== "check") {
		throw new Error(`Unknown command: ${command}. Use report, check, or apply.`);
	}
	const rows = await collectStatus();
	if (asJson) console.log(JSON.stringify(rows, null, 2));
	else console.log(renderReport(rows));
	if (command === "check" && rows.some((row) => row.outdated)) {
		console.error("\nUpstream pins fell behind. Run with `apply` or see the daily sync PR.");
		process.exitCode = 1;
	}
}

const invokedAsScript =
	typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) {
	try {
		await main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
