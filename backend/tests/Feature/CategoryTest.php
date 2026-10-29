<?php

use App\Models\Category;
use Database\Seeders\CategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('lists only active categories in admin-defined order', function () {
    Category::factory()->create(['name_ar' => 'ثانٍ', 'sort' => 20]);
    Category::factory()->create(['name_ar' => 'أول', 'sort' => 10]);
    Category::factory()->inactive()->create(['name_ar' => 'متوقف', 'sort' => 5]);

    $response = $this->getJson('/api/categories')->assertOk();

    expect($response->json('data.*.name'))->toBe(['أول', 'ثانٍ'])
        ->and(array_keys($response->json('data.0')))->toBe(['id', 'slug', 'name']);
});

it('seeds the three hypothesis categories idempotently without overwriting admin edits', function () {
    $this->seed(CategorySeeder::class);
    Category::query()->where('slug', 'belts')->update(['name_ar' => 'اسم عدّله المدير']);
    $this->seed(CategorySeeder::class);

    expect(Category::query()->orderBy('sort')->pluck('slug')->all())->toBe(['bearings', 'belts', 'seals-couplings'])
        ->and(Category::query()->where('slug', 'belts')->value('name_ar'))->toBe('اسم عدّله المدير');
});
