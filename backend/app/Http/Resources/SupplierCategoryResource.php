<?php

namespace App\Http\Resources;

use App\Models\Category;
use App\Models\SupplierCategory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An active category with this supplier's specialty status: null (not chosen), pending or approved.
 *
 * @mixin Category
 */
class SupplierCategoryResource extends JsonResource
{
    public function __construct(Category $category, private readonly ?SupplierCategory $mine)
    {
        parent::__construct($category);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name_ar,
            'status' => $this->mine?->status->value,
        ];
    }
}
