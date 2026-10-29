<?php

use App\Providers\AppServiceProvider;
use App\Support\TestDatabaseSafety;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

uses(RefreshDatabase::class);

it('runs against the dedicated test database only', function () {
    expect(DB::connection()->getDriverName())->toBe('mariadb')
        ->and(DB::connection()->getDatabaseName())->toBe(TestCase::TEST_DATABASE);
});

it('targets a supported MariaDB 11.4 server', function () {
    $version = DB::scalar('select version()');

    expect($version)->toStartWith('11.4.')->toContain('MariaDB');
});

it('applies the migrations to the test schema', function () {
    expect(Schema::hasTable('users'))->toBeTrue()
        ->and(Schema::hasTable('sessions'))->toBeTrue();
});

it('refuses to run against any database other than the test one', function () {
    config(['database.connections.mariadb.database' => 'warridli']);

    expect(fn () => $this->ensureTestDatabase())
        ->toThrow(RuntimeException::class, TestDatabaseSafety::REFUSAL);
});

it('refuses to boot in e2e mode against any database other than warridli_test', function () {
    $this->app['env'] = 'e2e';
    config(['database.connections.mariadb.database' => 'warridli']);

    expect(fn () => (new AppServiceProvider($this->app))->boot())
        ->toThrow(RuntimeException::class, TestDatabaseSafety::REFUSAL);

    config(['database.connections.mariadb.database' => TestCase::TEST_DATABASE]);
    expect(fn () => (new AppServiceProvider($this->app))->boot())->not->toThrow(RuntimeException::class);
});

it('refuses unsafe test connection settings before database traits can run', function (array $overrides) {
    config(['database.connections.mariadb' => array_replace(config('database.connections.mariadb'), $overrides)]);

    expect(fn () => $this->ensureTestDatabase())->toThrow(RuntimeException::class);
})->with([
    'wrong port' => [['port' => '3306']],
    'non-local host' => [['host' => '192.0.2.1']],
    'URL overrides the safe database name' => [['url' => 'mariadb://127.0.0.1:3307/warridli']],
    'separate write target' => [['write' => ['database' => 'warridli']]],
    'URL supplies a write target' => [['url' => 'mariadb://127.0.0.1:3307/warridli_test?write[database]=warridli']],
]);

it('refuses unsafe e2e connection settings before commands can run', function (array $overrides) {
    $this->app['env'] = 'e2e';
    config(['database.connections.mariadb' => array_replace(config('database.connections.mariadb'), $overrides)]);

    expect(fn () => (new AppServiceProvider($this->app))->boot())->toThrow(RuntimeException::class);
})->with([
    'wrong port' => [['port' => '3306']],
    'non-local host' => [['host' => '192.0.2.1']],
    'URL overrides the safe database name' => [['url' => 'mariadb://127.0.0.1:3307/warridli']],
    'separate read target' => [['read' => ['database' => 'warridli']]],
    'URL supplies a read target' => [['url' => 'mariadb://127.0.0.1:3307/warridli_test?read[database]=warridli']],
]);
