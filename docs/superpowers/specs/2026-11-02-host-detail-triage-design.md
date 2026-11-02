# Host Detail Triage Design

## Intent

Make the host detail route a dependable one-page triage surface for the solo BlackWatch operator. On entry, answer whether the agent and its collectors are working, what security-relevant activity needs attention, and where to inspect complete host evidence.

## Primary user action

Spot and inspect the newest security-relevant change on a host, then jump directly to its supporting inventory or history.

## Constraints and non-goals

- Keep all current host telemetry accessible on `/hosts/[id]`.
- Do not change agent collection, API contracts, projections, or database schema.
- Preserve all table search, pagination, and full package inventory access.
- Do not hide whole evidence domains behind generic accordions.
- Keep the current dark, dense BlackWatch visual language, severity palette, fonts, and component system.

## Information architecture

1. Host header: display name, host/instance identity, environment tags, account, and region.
2. Overview: compact host health and collector freshness on the left; prioritized findings and recent security activity on the right.
3. CPU and memory history directly below the overview.
4. Sticky in-page section navigation: Overview, Access, Integrity, Runtime, Capacity, Agent & delivery.
5. All evidence sections remain in the document, with clear headings, concise context, and searchable/paginated tables. No generic expand/collapse wrappers.

## Triage behavior

- High/critical alerts are surfaced separately from the chronological activity feed.
- The activity feed includes SSH/sudo events, host inventory changes, package changes, and FIM changes; it is newest-first and bounded to a concise recent window.
- Current host health includes last-seen time, CPU load, memory use, and collector current/stale/failed counts. Collector-level diagnostics remain available from that summary.
- Sequence, transport, rollout, tick, tags, and package database diagnostics live in the explicit Agent & delivery section.
- Counts label their own collection (sessions, users, paths, files, packages); do not sum unlike evidence into a misleading category total.

## Design direction

- Restrained color: neutral surfaces, signal teal for focus/selection, severity colors only for state.
- Scene: a solo security operator on a desktop during an incident review, scanning a dark console quickly and drilling into evidence without leaving the host.
- Existing BlackWatch forensic-minimalism direction; familiar density and hierarchy from expert tools such as Linear and Sentry.
- Desktop uses a narrow health column beside a wider activity column. Mobile stacks health and activity, then keeps section navigation horizontally reachable.

## Responsive and interaction requirements

- Section links use normal anchor navigation and visible focus states; heading scroll offsets account for the sticky navigation.
- Activity and inventory tables retain horizontal overflow, search where supported, and standard pagination.
- Long lists have no nested scroll containers or arbitrary row caps.
- Empty activity states distinguish “no recent findings” from missing telemetry.

## Acceptance criteria

- A user can see host freshness, current resource readings, collector health, and recent high-priority changes before opening an inventory.
- Every telemetry domain currently rendered on this route remains present and reachable by one section jump.
- Generic category accordions and misleading aggregate item counts are removed.
- The page remains usable at mobile widths and keyboard navigation can reach all section links and tables.
- UI TypeScript check and production UI build succeed; no backend or database behavior changes.
