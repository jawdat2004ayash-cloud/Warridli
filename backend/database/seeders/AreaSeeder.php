<?php

namespace Database\Seeders;

use App\Models\Area;
use Illuminate\Database\Seeder;

/**
 * Initial, founder-reviewable list of Damascus / Rural Damascus areas (admin-editable data, not a fixed taxonomy).
 * Idempotent: safe to run more than once; never deletes rows.
 */
class AreaSeeder extends Seeder
{
    /** @var list<string> */
    private const AREAS = [
        'دمشق — الزبلطاني',
        'دمشق — القابون',
        'دمشق — الميدان',
        'دمشق — المزة',
        'دمشق — مناطق أخرى',
        'ريف دمشق — المدينة الصناعية بعدرا',
        'ريف دمشق — جرمانا',
        'ريف دمشق — حرستا',
        'ريف دمشق — دوما',
        'ريف دمشق — صحنايا',
        'ريف دمشق — داريا',
        'ريف دمشق — قدسيا',
        'ريف دمشق — الكسوة',
        'ريف دمشق — مناطق أخرى',
    ];

    public function run(): void
    {
        foreach (self::AREAS as $index => $name) {
            Area::query()->firstOrCreate(['name_ar' => $name], ['sort' => ($index + 1) * 10]);
        }
    }
}
