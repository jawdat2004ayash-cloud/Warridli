<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

it('reports ok when the database is reachable', function () {
    $this->getJson('/api/health')
        ->assertOk()
        ->assertExactJson(['status' => 'ok', 'database' => 'ok']);
});

it('reports degraded without leaking error details when the database is down', function () {
    DB::shouldReceive('select')->once()->andThrow(new RuntimeException('SQLSTATE secret-host-detail'));
    Log::shouldReceive('error')->once();

    $this->getJson('/api/health')
        ->assertStatus(503)
        ->assertExactJson(['status' => 'degraded', 'database' => 'unavailable'])
        ->assertDontSee('secret-host-detail');
});

it('rejects non-GET methods', function () {
    $this->postJson('/api/health')->assertStatus(405);
});
