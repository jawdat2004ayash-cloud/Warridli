<?php

namespace App\Http\Resources\Admin;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A category with what depends on it, so the admin sees the effect of renaming or deactivating it.
 * Expects `rfqs_count`, `open_rfqs_count`, `suppliers_count` from withCount (CategoryController::query()).
 *
 * @mixin Category
 */
class AdminCategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name_ar,
            'is_active' => $this->is_active,
            'sort' => $this->sort,
            'rfqs_count' => (int) $this->getAttribute('rfqs_count'),
            'open_rfqs_count' => (int) $this->getAttribute('open_rfqs_count'),
            'suppliers_count' => (int) $this->getAttribute('suppliers_count'),
        ];
    }
}
