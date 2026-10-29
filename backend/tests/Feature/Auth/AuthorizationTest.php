<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

beforeEach(function () {
    // Same middleware stack as the real admin routes (routes/api.php).
    Route::middleware(['api', 'auth:sanctum', 'active', 'admin'])
        ->get('/api/__test/admin-only', fn () => response()->json(['ok' => true]));
});

it('lets only active admins through the admin gate', function () {
    $this->getJson('/api/__test/admin-only')->assertUnauthorized();

    $this->actingAs(User::factory()->create());
    spa()->getJson('/api/__test/admin-only')
        ->assertForbidden()
        ->assertExactJson(['message' => 'ليست لديك صلاحية للقيام بهذا الإجراء.']);

    $this->actingAs(User::factory()->admin()->create());
    spa()->getJson('/api/__test/admin-only')->assertOk();
});

it('denies suspended admins', function () {
    $this->actingAs(User::factory()->admin()->suspended()->create());

    spa()->getJson('/api/__test/admin-only')->assertForbidden();
});

it('exposes exactly the expected API routes (no user listing, no password read/set endpoint)', function () {
    $routes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route) => str_starts_with($route->uri(), 'api/') && ! str_starts_with($route->uri(), 'api/__test'))
        ->map(fn ($route) => implode('|', array_diff($route->methods(), ['HEAD'])).' '.$route->uri())
        ->sort()->values()->all();

    expect($routes)->toBe([
        'GET api/admin/audit-logs',
        'GET api/admin/categories',
        'GET api/admin/companies',
        'GET api/admin/metrics',
        'GET api/admin/rfqs',
        'GET api/admin/rfqs/{rfq}',
        'GET api/admin/rfqs/{rfq}/photos/{attachment}',
        'GET api/areas',
        'GET api/categories',
        'GET api/health',
        'GET api/me',
        'GET api/notifications',
        'GET api/notifications/unread-count',
        'GET api/rfqs',
        'GET api/rfqs/{rfq}',
        'GET api/rfqs/{rfq}/photos/{attachment}',
        'GET api/rfqs/{rfq}/quotes',
        'GET api/supplier/categories',
        'GET api/supplier/rfqs',
        'GET api/supplier/rfqs/{rfq}',
        'GET api/supplier/rfqs/{rfq}/photos/{attachment}',
        'PATCH api/admin/categories/{category}',
        'POST api/admin/categories',
        'POST api/admin/companies/{company}/{transition}',
        'POST api/admin/rfqs/{rfq}/reject',
        'POST api/admin/rfqs/{rfq}/triage',
        'POST api/admin/supplier-categories/{company}/{category}/approve',
        'POST api/admin/supplier-categories/{company}/{category}/reject',
        'POST api/admin/users/{user}/reactivate',
        'POST api/admin/users/{user}/suspend',
        'POST api/auth/forgot-password',
        'POST api/auth/login',
        'POST api/auth/logout',
        'POST api/auth/register',
        'POST api/auth/reset-password',
        'POST api/notifications/read-all',
        'POST api/notifications/{notification}/read',
        'POST api/rfqs',
        'POST api/rfqs/{rfq}/cancel',
        'POST api/rfqs/{rfq}/close',
        'POST api/rfqs/{rfq}/quotes/{quote}/contact',
        'POST api/rfqs/{rfq}/quotes/{quote}/select',
        'POST api/supplier/rfqs/{rfq}/quote/withdraw',
        'PUT api/supplier/categories',
        'PUT api/supplier/rfqs/{rfq}/quote',
    ]);
});

it('requires authentication on every non-guest API route', function () {
    $this->getJson('/api/me')->assertUnauthorized();
    $this->postJson('/api/auth/logout')->assertUnauthorized();
    $this->getJson('/api/admin/companies')->assertUnauthorized();
    $this->postJson('/api/admin/companies/1/approve')->assertUnauthorized();
    $this->postJson('/api/admin/users/1/suspend')->assertUnauthorized();
});

it('puts every admin route behind the admin middleware', function () {
    $adminRoutes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route) => str_starts_with($route->uri(), 'api/admin'));

    expect($adminRoutes)->not->toBeEmpty();
    $adminRoutes->each(fn ($route) => expect($route->gatherMiddleware())->toContain('auth:sanctum', 'active', 'admin'));
});

it('puts every supplier inbox/quote route behind the approved-supplier middleware', function () {
    $routes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route) => str_starts_with($route->uri(), 'api/supplier/rfqs'));

    expect($routes)->toHaveCount(5);
    $routes->each(fn ($route) => expect($route->gatherMiddleware())->toContain('auth:sanctum', 'active', 'supplier'));
});

it('answers a CSRF failure with an Arabic 419', function () {
    // CSRF verification itself is skipped by Laravel under tests; the real check is exercised over HTTP / in M2b.
    Route::middleware('api')->post('/api/__test/csrf', fn () => throw new TokenMismatchException);

    $this->postJson('/api/__test/csrf')->assertStatus(419)
        ->assertExactJson(['message' => 'انتهت صلاحية الصفحة. حدّث الصفحة ثم حاول مرة أخرى.']);
});

it('answers unknown API routes with an Arabic 404', function () {
    $this->getJson('/api/users')->assertNotFound()->assertExactJson(['message' => 'الصفحة أو العنصر المطلوب غير موجود.']);
});
