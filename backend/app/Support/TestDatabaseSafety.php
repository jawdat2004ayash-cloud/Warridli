<?php

namespace App\Support;

use Illuminate\Database\ConfigurationUrlParser;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

/** Fail before test migrations or writes; a database URL can override otherwise safe-looking fields. */
final class TestDatabaseSafety
{
    public const REFUSAL = 'Refusing test database access: only MariaDB warridli_test at 127.0.0.1:3307 is allowed.';

    public static function ensure(): void
    {
        $name = config('database.default');
        $raw = config("database.connections.{$name}");
        try {
            $resolved = is_array($raw) ? (new ConfigurationUrlParser)->parseConfiguration($raw) : [];
        } catch (Throwable) {
            // Never include connection strings or credentials in an exception.
            throw new RuntimeException(self::REFUSAL);
        }

        if ($name !== 'mariadb' || ! self::allowed($resolved)) {
            throw new RuntimeException(self::REFUSAL);
        }
    }

    /** Read-only live-server verification, used before browser-test preparation. */
    public static function verifyServer(): void
    {
        self::ensure();
        $connection = DB::connection();
        if (! self::allowed($connection->getConfig())) {
            throw new RuntimeException(self::REFUSAL);
        }
        $server = $connection->selectOne('SELECT DATABASE() AS db, @@port AS port, VERSION() AS version');
        if ($server === null || $server->db !== 'warridli_test' || (int) $server->port !== 3307
            || ! str_starts_with($server->version, '11.4.') || ! str_contains($server->version, 'MariaDB')) {
            throw new RuntimeException(self::REFUSAL);
        }
    }

    /** @param array<string, mixed> $config */
    private static function allowed(array $config): bool
    {
        return ($config['driver'] ?? null) === 'mariadb'
            && ($config['database'] ?? null) === 'warridli_test'
            && ($config['host'] ?? null) === '127.0.0.1'
            && (string) ($config['port'] ?? '') === '3307'
            && empty($config['unix_socket'])
            && ! isset($config['read']) && ! isset($config['write']);
    }
}
