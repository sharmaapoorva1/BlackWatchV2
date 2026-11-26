# BlackWatch agent workflow

This file is the project-level operating contract for Codex and other agentic
workers. `CLAUDE.md` contains the existing Graphify-specific guidance; these
rules add the BlackWatch coordination and safety boundary.

## Non-negotiable data-safety priority

Data preservation is the first priority. Existing Postgres data, tables,
columns, rows, configuration, audit history, and collected security evidence
must never be removed as a side effect of a build, rebuild, migration, agent
run, or feature change.

All agents and developers must:

- preserve the `bw_pgdata` Compose volume and never use `docker compose down -v`;
- treat migration SQL as additive and data-preserving; automatic `DROP TABLE`,
  `DROP COLUMN`, `TRUNCATE`, `DELETE FROM`, `DROP SCHEMA`, and `DROP DATABASE`
  operations are prohibited;
- stop and request an explicit operator decision if a change appears to need
  destructive data handling; never work around the safety check;
- keep deployment, migration, backup, and volume changes separate from normal
  application builds;
- verify the existing database and volume before changing Compose storage or
  migration behavior.

The database migration runner fails closed when it detects a prohibited
destructive statement. A successful image build is not evidence that data is
safe; storage and migration verification are required before claiming a
deployment is complete.

## EC2 agent documentation

`docs/ec2-agent.md` is the single source of truth for the EC2 agent: collection,
transports, ingestion, FIM, installation and operations. Before changing EC2
agent collection, report formats, ingestion, or host projections, read it, and
update it in the same change so it only ever describes the current behavior. Do
not add a second EC2 document, a changelog, or a decision log; rewrite the
affected section instead. Verify every claim against the code.

