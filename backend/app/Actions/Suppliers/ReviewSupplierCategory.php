<?php

namespace App\Actions\Suppliers;

use App\Enums\NotificationKind;
use App\Enums\SupplierCategoryStatus;
use App\Models\Category;
use App\Models\Company;
use App\Models\SupplierCategory;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Notifier;
use Illuminate\Support\Facades\DB;

/**
 * Admin verifies (approve) or declines (reject = remove the request) a supplier's pending specialty (D30).
 * $admin is null only when run from the CLI (`warridli:approve-supplier`), which is then the audited actor.
 */
class ReviewSupplierCategory
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly Notifier $notifier,
    ) {}

    public function approve(Company $supplier, Category $category, ?User $admin): void
    {
        DB::transaction(function () use ($supplier, $category, $admin) {
            $row = $this->pendingRow($supplier, $category);
            $row->forceFill(['status' => SupplierCategoryStatus::Approved, 'approved_by' => $admin?->id, 'approved_at' => now()])->save();
            $log = $this->audit->record('supplier_category.approved', $supplier, ['category_id' => $category->id], $admin);
            $this->notifier->toCompany($supplier, NotificationKind::SpecialtyApproved, "audit:{$log->id}", ['category' => $category->name_ar]);
        });
    }

    public function reject(Company $supplier, Category $category, User $admin, ?string $reason): void
    {
        DB::transaction(function () use ($supplier, $category, $admin, $reason) {
            $this->pendingRow($supplier, $category)->delete();
            $log = $this->audit->record('supplier_category.rejected', $supplier, ['category_id' => $category->id, 'reason' => $reason], $admin);
            $this->notifier->toCompany($supplier, NotificationKind::SpecialtyRejected, "audit:{$log->id}", ['category' => $category->name_ar]);
        });
    }

    private function pendingRow(Company $supplier, Category $category): SupplierCategory
    {
        $row = SupplierCategory::query()
            ->where('company_id', $supplier->id)
            ->where('category_id', $category->id)
            ->lockForUpdate()
            ->first();

        if ($row === null || $row->status !== SupplierCategoryStatus::Pending) {
            abort(409, 'لا يوجد طلب تخصص قيد المراجعة لهذا المورّد في هذا التصنيف.');
        }

        return $row;
    }
}
