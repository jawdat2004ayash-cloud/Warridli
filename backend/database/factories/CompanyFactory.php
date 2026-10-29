<?php

namespace Database\Factories;

use App\Enums\CompanyRole;
use App\Enums\CompanyStatus;
use App\Enums\CompanyType;
use App\Models\Area;
use App\Models\Company;
use App\Models\CompanyMember;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Company>
 */
class CompanyFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'type' => CompanyType::Buyer,
            'name' => 'ورشة '.fake()->unique()->numberBetween(1, 1_000_000),
            'whatsapp_phone' => '+9639'.fake()->numerify('########'),
            'area_id' => Area::factory(),
            'address_text' => null,
            'status' => CompanyStatus::Approved,
        ];
    }

    public function supplier(CompanyStatus $status = CompanyStatus::Pending): static
    {
        return $this->state(['type' => CompanyType::Supplier, 'status' => $status]);
    }

    /**
     * Attach $user (or a new user) as owner.
     */
    public function ownedBy(?User $user = null): static
    {
        return $this->afterCreating(function (Company $company) use ($user) {
            $membership = new CompanyMember;
            $membership->company()->associate($company);
            $membership->user()->associate($user ?? User::factory()->create());
            $membership->role = CompanyRole::Owner;
            $membership->save();
        });
    }
}
