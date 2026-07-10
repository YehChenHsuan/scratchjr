# Local Storage and Backup Specification

## Requirements

- IndexedDB remains the source of truth for projects, media, user shapes, user backgrounds, files, and gesture models.
- The app requests persistent storage where supported and exposes the result for diagnostics.
- Service-worker updates do not clear application data.
- Web project export creates a real `.sjr` ZIP containing project JSON and referenced user media.
- Import validates the archive before writing and does not partially import invalid content.

## Platform limitation

Persistent storage lowers eviction risk but cannot prevent deletion caused by clearing site data, browser reset, or operating-system policy. Exported backups are the recovery mechanism.

