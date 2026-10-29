<?php

namespace App\Http\Controllers;

use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CategoryController extends Controller
{
    /**
     * Active categories for the RFQ form. Small, admin-curated table, so not paginated.
     */
    public function __invoke(): AnonymousResourceCollection
    {
        return CategoryResource::collection(Category::query()->listed()->get());
    }
}
