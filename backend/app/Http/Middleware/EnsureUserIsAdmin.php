<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

/**
 * Same check as `can:admin`, but registered in the middleware priority list *before* route model binding
 * (bootstrap/app.php), so a non-admin gets 403 for every admin URL and cannot probe which IDs exist (404).
 */
class EnsureUserIsAdmin
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        Gate::forUser($request->user())->authorize('admin');

        return $next($request);
    }
}
