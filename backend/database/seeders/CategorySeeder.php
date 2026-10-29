<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

/**
 * Initial part categories — HYPOTHESES from the spec (bearings, belts, seals/couplings), to be validated with
 * real buyers and suppliers (D25). Admin-editable data, not a fixed taxonomy.
 * Idempotent by slug: safe to run more than once; never deletes or renames rows an admin may have edited.
 */
class CategorySeeder extends Seeder
{
    /** @var array<string, string> slug => Arabic name */
    private const CATEGORIES = [
        'bearings' => 'بيليا ورولمان (محامل)',
        'belts' => 'سيور وقشاط نقل الحركة',
        'seals-couplings' => 'جوانات وصوفات ووصلات (كوبلنج)',
    ];

    public function run(): void
    {
        $sort = 10;
        foreach (self::CATEGORIES as $slug => $name) {
            Category::query()->firstOrCreate(['slug' => $slug], ['name_ar' => $name, 'sort' => $sort]);
            $sort += 10;
        }
    }
}
