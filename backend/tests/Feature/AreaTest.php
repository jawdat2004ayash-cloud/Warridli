<?php

use App\Models\Area;
use Database\Seeders\AreaSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('lists areas publicly in sort order', function () {
    Area::factory()->create(['name_ar' => 'ب', 'sort' => 20]);
    Area::factory()->create(['name_ar' => 'أ', 'sort' => 10]);

    $this->getJson('/api/areas')
        ->assertOk()
        ->assertJsonPath('data.0.name', 'أ')
        ->assertJsonPath('data.1.name', 'ب');
});

it('seeds areas idempotently', function () {
    $this->seed(AreaSeeder::class);
    $count = Area::query()->count();
    $this->seed(AreaSeeder::class);

    expect($count)->toBeGreaterThan(0)
        ->and(Area::query()->count())->toBe($count);
});
