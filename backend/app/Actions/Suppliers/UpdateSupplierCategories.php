<?php

namespace App\Actions\Suppliers;

use App\Enums\SupplierCategoryStatus;
use App\Models\Category;
use App\Models\Company;
use App\Models\SupplierCategory;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * The supplier declares its specialties (D30). New ones start `pending` until an admin verifies them;
 * unchecked ones are removed (the supplier stops receiving that category). Already approved ones stay approved,
 * and specialties in a deactivated category are kept as they are.
 */
class UpdateSupplierCategories
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  list<int>  $categoryIds  active category ids (validated)
     */
    public function handle(Company $supplier, User $user, array $categoryIds): void
    {
        DB::transaction(function () use ($supplier, $user, $categoryIds) {
            $current = SupplierCategory::query()->where('company_id', $supplier->id)->lockForUpdate()->get()->keyBy('category_id');

            // Deactivated categories are not on the supplier's form, so their absence is not a removal (D36).
            $inactive = Category::query()->whereIn('id', $current->keys())->where('is_active', false)->pluck('id')->all();

            foreach ($current as $categoryId => $row) {
                if (! in_array($categoryId, $categoryIds, true) && ! in_array($categoryId, $inactive, true)) {
                    $row->delete();
                    $this->audit->record('supplier_category.removed', $supplier, ['category_id' => $categoryId, 'was' => $row->status->value], $user);
                }
            }

            foreach ($categoryIds as $categoryId) {
                if ($current->has($categoryId)) {
                    continue;
                }
                $row = new SupplierCategory;
                $row->forceFill(['company_id' => $supplier->id, 'category_id' => $categoryId, 'status' => SupplierCategoryStatus::Pending])->save();
                $this->audit->record('supplier_category.requested', $supplier, ['category_id' => $categoryId], $user);
            }
        });
    }
}
