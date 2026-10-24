// Type-only shim for the upstream TS entrypoint, wired via tsconfig "paths".
//
// pi-deep-research ships extension.ts as source (no "type": "module", no
// bundled types), and its sources are not clean under this package's
// NodeNext + strict config (import.meta under CJS detection, untyped
// callbacks, jiti/typebox resolution). Loading the real file into tsc would
// fail the check on upstream code this wrapper must not touch, so the import
// is typed here instead. At runtime (pi's loader, jiti in tests) the real
// extension.ts resolves normally; tests additionally pin the behavior
// contract (tool names, schemas, checkpoint verdicts).
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function activate(pi: ExtensionAPI): Promise<void>;
