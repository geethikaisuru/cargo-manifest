# Outputs

What happened. The append-only archive of everything the GTM engine and its
operators produced: research briefs, campaign results, list builds, weekly
reviews. This is the repo's accumulating memory.

## Conventions

- One directory per artifact: `outputs/YYYY-MM-DD-<slug>/`.
- Every entry has a `README.md` stating: what ran, the headline result, and
  where the full data lives (files in the entry, or a link).
- Append-only. Never rewrite or delete an existing entry; correct it with a
  dated addendum.
- Agents: before starting research, a campaign, or a review, read the recent
  entries here for prior art. After finishing, write your entry.
- Learning graduates upward: durable conclusions move to `context/` via the
  `cadence` skill's Friday review, with the outputs entry as evidence.
- Large raw data (CSVs over a few MB) goes to workspace storage, not git;
  the entry links to it. A batch's own input file is the exception, up to the
  50 MB the CDK accepts (see Executions below).

## Executions: an entry that runs something

Most entries record what already happened. An entry can also declare a one-off
run, written before it happens and run by the merge: enroll these 40 accounts
into a play, backfill this field on 214 companies. Use the `new-execution`
skill to write one.

```
outputs/2026-10-14-expansion-pilot/
├── expansion-pilot.ts   defineBatch("2026-10-14-expansion-pilot", ...)
├── accounts.csv         the batch's rows, when its data is a file
└── README.md            outcome: pending, until the run finishes
```

- `cargo.json` names `outputs/` as where executions live, so every `.ts`
  file here is loaded by the CDK. Keep only executions in them.
- The `.ts` file declares one `defineBatch` (a play, tool, or workflow run once
  per record) or `defineRun` (a tool or workflow run once). Its id is the
  directory name. It imports what it runs from `infra/` by handle.
- The pull request previews it: how many records, what it sends, what it
  costs. Large ones need the `cargo:approve-impact` label.
- The merge runs it exactly once. Cargo keeps a ledger of the ids that ran, so
  moving, editing or deleting the file afterwards changes nothing. To run it
  again, write a new entry.
- The `README.md` says `outcome: pending` until the run finishes. Filling that
  in once, from the batch or run's result, completes the entry; it is not a
  rewrite. Later corrections are dated addenda, as for any entry.
- A filter batch needs a `limit`, and a file at most 50 MB.

Executions run only from Cargo's own deploy, once the repository is connected
to the workspace (Settings > States): it is the deploy that previews each one
on its pull request and starts only what was approved. A held execution stays
pending until a later pull request previews it again.
