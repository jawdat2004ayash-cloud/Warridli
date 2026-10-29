<?php

namespace App\Http\Controllers;

use App\Http\Resources\AreaResource;
use App\Models\Area;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AreaController extends Controller
{
    /**
     * Public list for the registration form. Small, admin-curated table, so not paginated.
     */
    public function __invoke(): AnonymousResourceCollection
    {
        return AreaResource::collection(Area::query()->orderBy('sort')->orderBy('id')->get());
    }
}
