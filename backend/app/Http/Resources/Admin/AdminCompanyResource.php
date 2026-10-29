<?php

namespace App\Http\Resources\Admin;

use App\Http\Resources\AreaResource;
use App\Models\Company;
use App\Models\CompanyMember;
use App\Models\SupplierCategory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A company as the admin reviews it. Explicit allow-list; expects area + members.user eager-loaded.
 *
 * @mixin Company
 */
class AdminCompanyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'name' => $this->name,
            'whatsapp_phone' => $this->whatsapp_phone,
            'area' => new AreaResource($this->area),
            'address_text' => $this->address_text,
            'status' => $this->status->value,
            'verified_at' => $this->verified_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'members' => $this->members->map(fn (CompanyMember $member) => [
                'user_id' => $member->user->id,
                'name' => $member->user->name,
                'email' => $member->user->email,
                'role' => $member->role->value,
                'suspended' => $member->user->isSuspended(),
            ])->values()->all(),
            // Supplier specialties to verify (D30); always empty for buyers.
            'categories' => $this->supplierCategories->map(fn (SupplierCategory $row) => [
                'id' => $row->category->id,
                'name' => $row->category->name_ar,
                'status' => $row->status->value,
            ])->values()->all(),
        ];
    }

    /**
     * @return list<string>
     */
    public static function relations(): array
    {
        return ['area', 'members.user', 'supplierCategories.category'];
    }
}
