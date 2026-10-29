<?php

namespace Database\Factories;

use App\Models\Area;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Area>
 */
class AreaFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name_ar' => 'منطقة '.fake()->unique()->numberBetween(1, 1_000_000),
            'sort' => fake()->numberBetween(0, 100),
        ];
    }
}
