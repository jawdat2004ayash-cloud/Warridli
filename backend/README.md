# Warridli backend

Laravel API for the Warridli diploma project. Start with the [project README](../README.md) for the actual
PHP/MariaDB requirements, new instructor lab setup, role workflow and guarded test instructions.

- [API contract](../docs/API.md) and [ERD](../docs/ERD.md)
- [Test preflight and instructor handoff](../docs/HANDOFF.md)
- [Backup/restore](../docs/BACKUP_RESTORE.md), [deployment](../docs/DEPLOYMENT.md), [release gates](../docs/RELEASE_READINESS.md)

Do not run `composer setup`, install Boost, regenerate an existing APP_KEY or migrate the owner's development
database as part of setup. Use the locked dependencies and separate empty instructor/test schemas described
in the root README. No fixed account passwords or database exports are supplied.
