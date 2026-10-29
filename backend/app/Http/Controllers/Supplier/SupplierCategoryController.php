<?php

namespace App\Http\Controllers\Supplier;

use App\Actions\Suppliers\UpdateSupplierCategories;
use App\Http\Controllers\Controller;
use App\Http\Requests\Suppliers\UpdateSupplierCategoriesRequest;
use App\Http\Resources\SupplierCategoryResource;
use App\Models\Category;
use App\Models\Company;
use App\Models\SupplierCategory;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The supplier's own specialties. Open to any supplier company (also under review), so it can prepare them
 * while waiting for approval; only admin-approved ones make RFQs visible.
 */
class SupplierCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $company = UpdateSupplierCategoriesRequest::supplierCompany($request);
        abort_if($company === null, 403, 'تخصصات المورّد متاحة لحسابات المورّدين فقط.');

        return $this->listFor($company);
    }

    public function update(UpdateSupplierCategoriesRequest $request, UpdateSupplierCategories $action): JsonResponse
    {
        /** @var Company $company */
        $company = UpdateSupplierCategoriesRequest::supplierCompany($request);
        /** @var User $user */
        $user = $request->user();

        $action->handle($company, $user, $request->categoryIds());

        return $this->listFor($company);
    }

    private function listFor(Company $company): JsonResponse
    {
        $mine = SupplierCategory::query()->where('company_id', $company->id)->get()->keyBy('category_id');

        return response()->json([
            'data' => Category::query()->listed()->get()
                ->map(fn (Category $category) => (new SupplierCategoryResource($category, $mine->get($category->id)))->resolve())
                ->values()->all(),
        ]);
    }
}
