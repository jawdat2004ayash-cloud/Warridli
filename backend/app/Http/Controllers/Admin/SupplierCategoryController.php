<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Suppliers\ReviewSupplierCategory;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminReasonRequest;
use App\Http\Resources\Admin\AdminCompanyResource;
use App\Models\Category;
use App\Models\Company;
use App\Models\User;

/**
 * Admin only — enforced by the `admin` middleware on the route group (routes/api.php).
 * Verifies a supplier's requested specialty (D30); the visual panel for this is M4a.
 */
class SupplierCategoryController extends Controller
{
    public function approve(AdminReasonRequest $request, Company $company, Category $category, ReviewSupplierCategory $action): AdminCompanyResource
    {
        $action->approve($company, $category, $this->admin($request));

        return new AdminCompanyResource($company->load(AdminCompanyResource::relations()));
    }

    public function reject(AdminReasonRequest $request, Company $company, Category $category, ReviewSupplierCategory $action): AdminCompanyResource
    {
        $action->reject($company, $category, $this->admin($request), $request->reason());

        return new AdminCompanyResource($company->load(AdminCompanyResource::relations()));
    }

    private function admin(AdminReasonRequest $request): User
    {
        /** @var User $admin */
        $admin = $request->user();

        return $admin;
    }
}
