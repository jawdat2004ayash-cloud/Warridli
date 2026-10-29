<?php

namespace Database\Factories;

use App\Enums\RfqStatus;
use App\Enums\RfqUnit;
use App\Enums\RfqUrgency;
use App\Models\Area;
use App\Models\Category;
use App\Models\Company;
use App\Models\Rfq;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Rfq>
 */
class RfqFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'buyer_company_id' => Company::factory(),
            'created_by' => User::factory(),
            'category_id' => Category::factory(),
            'status' => RfqStatus::Open,
            'description' => 'بيليا لمحرك مضخة مياه',
            'part_number' => null,
            'machine_make' => null,
            'machine_model' => null,
            'quantity' => 2,
            'unit' => RfqUnit::Piece,
            'area_id' => Area::factory(),
            'urgency' => RfqUrgency::Normal,
            'closes_at' => now()->addDays(7),
        ];
    }

    /**
     * Created by $user for $user's company.
     */
    public function createdBy(User $user): static
    {
        $membership = $user->membership()->firstOrFail();

        return $this->state(['buyer_company_id' => $membership->company_id, 'created_by' => $user->id]);
    }
}
