# Secret Garden project instructions

Read `HANDOFF.md` before editing and follow the repository-root `AGENTS.md`.

## Development save compatibility policy

This project is actively in development. Support only the current garden-save and settings-save versions. Do not retain old plant generators, legacy deserializers, compatibility branches, migration helpers or duplicate settings fields to support old saves.

- Bump `SAVE_VERSION` in `garden-saves.mjs` when a plant generator or garden serialization change makes existing saves incompatible. Keep only the current generator implementation.
- Bump `SETTINGS_VERSION` in `preferences.mjs` for incompatible settings-save changes.
- Keep storage keys stable across payload-version bumps so obsolete records can be found and deleted.
- On a version mismatch, delete only that record. Garden slots become Empty and cannot auto-load; settings use current defaults. Preserve unrelated slots and the separate settings/garden records.
- Keep regression coverage for mismatch deletion and current-version loading. Do not add legacy fixtures that require compatibility implementations.

This policy supersedes historical migration/backwards-compatibility notes in the handoff. Add compatibility support only if the user explicitly changes this policy.
