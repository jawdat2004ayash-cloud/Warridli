<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MetricsRequest;
use App\Services\OperationalMetrics;
use Illuminate\Http\JsonResponse;

/**
 * Admin only — `admin` middleware on the route group.
 */
class MetricsController extends Controller
{
    public function __invoke(MetricsRequest $request, OperationalMetrics $metrics): JsonResponse
    {
        return response()->json(['data' => $metrics->compute($request->days())]);
    }
}
