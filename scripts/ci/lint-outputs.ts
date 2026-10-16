/**
 * Outputs layer linter.
 *
 * The outputs archive is what lets plays be ranked by results instead of
 * opinions, which only works if every entry says what it produced. So:
 *
 * Errors (exit 1):
 *   - an entry directory with no README.md
 *   - a README.md with no frontmatter, or missing `title` / `description`
 *   - a missing or empty `outcome:` field (meetings, replies, pipeline
 *     attributed: what this run actually produced)
 *   - a directory name that is not outputs/YYYY-MM-DD-<slug>/ (absolute dates
 *     everywhere)
 *   - an execution (`defineBatch` / `defineRun`) whose id is not the entry's
 *     directory name, or a second one in the same entry
 *   - `outcome: pending` on an entry that declares no execution: only an
 *     execution waiting for its merge has an outcome still to come
 *   - an execution declared in a `_`-prefixed directory: the CDK finds
 *     executions anywhere in the repository, so one in `_template/` would run
 *
 * Skipped:
 *   - `_`-prefixed directories (`_template/`), which are scaffolding rather
 *     than entries, apart from the execution check above
 *
 * Usage: tsx scripts/ci/lint-outputs.ts [outputsDir]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const OUTPUTS_DIR = resolve(process.argv[2] ?? "outputs");
const ENTRY_PATTERN = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$/;
// The id an execution is declared under. A text match is enough for a lint:
// the CDK, which decides what runs, reads the file's imports instead.
const EXECUTION_ID = /\bdefine(?:Batch|Run)\s*\(\s*["'`]([^"'`]+)["'`]/g;

const errors: string[] = [];

if (!existsSync(OUTPUTS_DIR)) {
  console.error(`outputs directory not found: ${OUTPUTS_DIR}`);
  process.exit(1);
}

// `_`-prefixed directories are scaffolding, not history: `_template/` is the
// shape a new entry is copied from, and it has no date, no outcome and nothing
// to report. Same convention as cadence/ and initiatives/, which use
// `_template.md`.
const directories = readdirSync(OUTPUTS_DIR, { withFileTypes: true }).filter(
  (entry) => entry.isDirectory(),
);
const entries = directories.filter((entry) => !entry.name.startsWith("_"));

for (const scaffold of directories.filter((entry) => entry.name.startsWith("_"))) {
  if (executionIds(join(OUTPUTS_DIR, scaffold.name)).length > 0) {
    errors.push(
      `${scaffold.name}: declares an execution, which the CDK would run. Keep execution examples in prose, not in a .ts file`,
    );
  }
}

for (const entry of entries) {
  if (!ENTRY_PATTERN.test(entry.name)) {
    errors.push(
      `${entry.name}: entry directories are named outputs/YYYY-MM-DD-<slug>/ (absolute dates, kebab-case slug)`,
    );
    continue;
  }

  const ids = executionIds(join(OUTPUTS_DIR, entry.name));
  if (ids.length > 1) {
    errors.push(
      `${entry.name}: declares ${ids.length} executions (${ids.join(", ")}). One entry, one execution`,
    );
  }
  for (const id of ids.filter((id) => id !== entry.name)) {
    errors.push(
      `${entry.name}: declares execution "${id}". Its id is the directory name, so the entry and the ledger name the same thing`,
    );
  }

  const readme = join(OUTPUTS_DIR, entry.name, "README.md");
  if (!existsSync(readme)) {
    errors.push(`${entry.name}: no README.md (every entry states what it was)`);
    continue;
  }

  const raw = readFileSync(readme, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    errors.push(`${entry.name}/README.md: no frontmatter block`);
    continue;
  }

  let frontmatter: Record<string, unknown>;
  try {
    const parsed = parseYaml(match[1]);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.push(`${entry.name}/README.md: frontmatter is not a mapping`);
      continue;
    }
    frontmatter = parsed as Record<string, unknown>;
  } catch (e) {
    errors.push(
      `${entry.name}/README.md: frontmatter parse error: ${(e as Error).message}`,
    );
    continue;
  }

  for (const field of ["title", "description", "outcome"]) {
    const value = frontmatter[field];
    if (value === null || value === undefined || String(value).trim() === "") {
      const hint =
        field === "outcome"
          ? ' (what this produced: meetings, replies, pipeline attributed, or "none" with a reason)'
          : "";
      errors.push(
        `${entry.name}/README.md: missing or empty frontmatter field "${field}"${hint}`,
      );
    }
  }

  if (String(frontmatter.outcome ?? "").trim() === "pending" && ids.length === 0) {
    errors.push(
      `${entry.name}/README.md: outcome "pending" is only for an entry whose execution runs on merge. Write what this produced`,
    );
  }
}

for (const e of errors) console.error(`error ${e}`);
console.log(
  `\noutputs lint: ${entries.length} entries, ${errors.length} errors`,
);
process.exit(errors.length > 0 ? 1 : 0);

/** The ids of the executions declared by the `.ts` files directly in `dir`. */
function executionIds(dir: string): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
    .flatMap((file) =>
      [...readFileSync(join(dir, file), "utf8").matchAll(EXECUTION_ID)].map(
        (match) => match[1],
      ),
    );
}
