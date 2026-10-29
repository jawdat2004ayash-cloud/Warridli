<?php

namespace Tests;

use App\Support\TestDatabaseSafety;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public const TEST_DATABASE = 'warridli_test';

    /**
     * Single entry point for RefreshDatabase / DatabaseMigrations / DatabaseTruncation.
     * The guard lives here (not in beforeRefreshingDatabase) because trait methods
     * would silently override a hook defined on this class.
     *
     * @return array<class-string, class-string>
     */
    protected function setUpTraits()
    {
        $this->ensureTestDatabase();

        return parent::setUpTraits();
    }

    /**
     * Refuses to run against any database other than the dedicated test one.
     */
    protected function ensureTestDatabase(): void
    {
        TestDatabaseSafety::ensure();
    }
}
