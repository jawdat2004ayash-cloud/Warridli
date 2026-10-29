<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The authenticated user's own profile. Explicit allow-list: never returns the raw model.
 *
 * @mixin User
 */
class MeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $membership = $this->membership;
        $company = $membership?->company;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'is_admin' => $this->is_admin,
            'company' => $company === null ? null : [
                'id' => $company->id,
                'type' => $company->type->value,
                'name' => $company->name,
                'whatsapp_phone' => $company->whatsapp_phone,
                'area' => new AreaResource($company->area),
                'address_text' => $company->address_text,
                'status' => $company->status->value,
                'role' => $membership->role->value,
            ],
        ];
    }

    public static function for(User $user): self
    {
        return new self($user->loadMissing('membership.company.area'));
    }
}
