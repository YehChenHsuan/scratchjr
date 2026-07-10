# ADR 0001: PWA Local-First Architecture

## Status

Accepted.

## Decision

Use a static installable PWA with same-origin AI dependencies and IndexedDB as the source of truth. Request persistent browser storage and provide `.sjr` export/import backups. Do not add accounts or cloud synchronization in this phase.

## Consequences

- Children can create and run projects without a network after installation.
- Application updates and user data have separate lifecycles.
- iPad installation uses Add to Home Screen and requires explicit platform testing.
- Clearing browser/site data may still delete local projects; exported backups remain necessary.

