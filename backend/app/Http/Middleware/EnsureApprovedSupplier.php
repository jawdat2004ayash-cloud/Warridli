<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

/**
 * `can:approved-supplier`, but placed before route model binding (bootstrap/app.php, D24): a pending, rejected
 * or non-supplier account gets the Arabic reason (403) for every supplier URL and cannot probe RFQ ULIDs.
 */
class EnsureApprovedSupplier
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        Gate::forUser($request->user())->authorize('approved-supplier');

        return $next($request);
    }
}
