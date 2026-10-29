<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\SaveCategory;
use App\Enums\RfqStatus;
use App\Enums\SupplierCategoryStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveCategoryRequest;
use App\Http\Resources\Admin\AdminCategoryResource;
use App\Models\Category;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Admin only — `admin` middleware on the route group. Add / rename / reorder / (de)activate; never delete (D36).
 */
class CategoryController extends Controller
{
    /**
     * All categories, active first then by admin order. Small curated table, so not paginated.
     */
    public function index(): AnonymousResourceCollection
    {
        return AdminCategoryResource::collection(
            self::query()->orderByDesc('is_active')->orderBy('sort')->orderBy('id')->get()
        );
    }

    public function store(SaveCategoryRequest $request, SaveCategory $action): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        /** @var array{name_ar: string, sort?: int|null} $data */
        $data = $request->categoryData();
        $category = $action->create($data, $admin);

        return $this->resource($category)->response()->setStatusCode(201);
    }

    public function update(SaveCategoryRequest $request, Category $category, SaveCategory $action): AdminCategoryResource
    {
        /** @var User $admin */
        $admin = $request->user();

        return $this->resource($action->update($category, $request->categoryData(), $admin));
    }

    private function resource(Category $category): AdminCategoryResource
    {
        /** @var Category $counted */
        $counted = self::query()->whereKey($category->id)->firstOrFail();

        return new AdminCategoryResource($counted);
    }

    /**
     * @return Builder<Category>
     */
    private static function query(): Builder
    {
        return Category::query()->select('categories.*')
            ->selectSub(fn ($q) => $q->from('rfqs')->selectRaw('count(*)')->whereColumn('rfqs.category_id', 'categories.id'), 'rfqs_count')
            ->selectSub(fn ($q) => $q->from('rfqs')->selectRaw('count(*)')->whereColumn('rfqs.category_id', 'categories.id')
                ->where('rfqs.status', RfqStatus::Open->value), 'open_rfqs_count')
            ->selectSub(fn ($q) => $q->from('supplier_categories')->selectRaw('count(*)')->whereColumn('supplier_categories.category_id', 'categories.id')
                ->where('supplier_categories.status', SupplierCategoryStatus::Approved->value), 'suppliers_count');
    }
}
