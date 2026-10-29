<?php

use App\Enums\CompanyTransition;
use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\CategoryController as AdminCategoryController;
use App\Http\Controllers\Admin\CompanyController;
use App\Http\Controllers\Admin\MetricsController;
use App\Http\Controllers\Admin\RfqController as AdminRfqController;
use App\Http\Controllers\Admin\SupplierCategoryController as AdminSupplierCategoryController;
use App\Http\Controllers\Admin\UserSuspensionController;
use App\Http\Controllers\AreaController;
use App\Http\Controllers\Auth\MeController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Rfqs\RfqController;
use App\Http\Controllers\Rfqs\RfqPhotoController;
use App\Http\Controllers\Rfqs\RfqQuoteController;
use App\Http\Controllers\Supplier\QuoteController;
use App\Http\Controllers\Supplier\SupplierCategoryController;
use App\Http\Controllers\Supplier\SupplierRfqController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class)
    ->middleware('throttle:30,1')
    ->name('health');

Route::get('/areas', AreaController::class)
    ->middleware('throttle:60,1')
    ->name('areas.index');

// Guest auth endpoints. Rate limiters are defined in AppServiceProvider.
Route::prefix('auth')->name('auth.')->group(function () {
    Route::post('/register', RegisterController::class)->middleware('throttle:register')->name('register');
    Route::post('/login', [SessionController::class, 'store'])->middleware('throttle:login')->name('login');
    Route::post('/forgot-password', [PasswordResetController::class, 'sendLink'])->middleware('throttle:password-reset')->name('password.email');
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:password-reset')->name('password.update');
});

Route::get('/categories', CategoryController::class)
    ->middleware('throttle:60,1')
    ->name('categories.index');

Route::middleware(['auth:sanctum', 'active', 'throttle:api'])->group(function () {
    Route::post('/auth/logout', [SessionController::class, 'destroy'])->name('auth.logout');
    Route::get('/me', MeController::class)->name('me');

    // In-app notifications (M4b): always the current user's own rows.
    Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::get('/notifications/unread-count', [NotificationController::class, 'unread'])->name('notifications.unread');
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead'])->name('notifications.read-all');
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead'])->whereUuid('notification')->name('notifications.read');

    // Buyer RFQs (M3a). Authorization: RfqPolicy (someone else's RFQ → 404).
    Route::get('/rfqs', [RfqController::class, 'index'])->name('rfqs.index');
    Route::post('/rfqs', [RfqController::class, 'store'])->middleware('throttle:rfq-create')->name('rfqs.store');
    Route::get('/rfqs/{rfq}', [RfqController::class, 'show'])->name('rfqs.show');
    Route::post('/rfqs/{rfq}/cancel', [RfqController::class, 'cancel'])->name('rfqs.cancel');
    // M3c: compare / choose / contact. {quote} is scope-bound to {rfq}.
    Route::post('/rfqs/{rfq}/close', [RfqController::class, 'close'])->name('rfqs.close');
    Route::get('/rfqs/{rfq}/quotes', [RfqQuoteController::class, 'index'])->name('rfqs.quotes.index');
    Route::post('/rfqs/{rfq}/quotes/{quote}/select', [RfqQuoteController::class, 'select'])
        ->whereNumber('quote')->scopeBindings()->name('rfqs.quotes.select');
    Route::post('/rfqs/{rfq}/quotes/{quote}/contact', [RfqQuoteController::class, 'contact'])
        ->whereNumber('quote')->scopeBindings()->middleware('throttle:contact')->name('rfqs.quotes.contact');
    Route::get('/rfqs/{rfq}/photos/{attachment}', [RfqPhotoController::class, 'forBuyer'])
        ->whereNumber('attachment')
        ->scopeBindings()
        ->name('rfqs.photos.show');

    // Supplier specialties (M3b): any supplier company, also while under review.
    Route::get('/supplier/categories', [SupplierCategoryController::class, 'index'])->name('supplier.categories.index');
    Route::put('/supplier/categories', [SupplierCategoryController::class, 'update'])->name('supplier.categories.update');

    // Supplier inbox + quotes (M3b). `supplier` = approved supplier company, checked before route model binding;
    // per-RFQ visibility = RfqPolicy::viewAsSupplier (D30: open + approved category, or already quoted) → else 404.
    Route::middleware('supplier')->prefix('supplier')->name('supplier.')->group(function () {
        Route::get('/rfqs', [SupplierRfqController::class, 'index'])->name('rfqs.index');
        Route::get('/rfqs/{rfq}', [SupplierRfqController::class, 'show'])->name('rfqs.show');
        Route::get('/rfqs/{rfq}/photos/{attachment}', [RfqPhotoController::class, 'forSupplier'])
            ->whereNumber('attachment')
            ->scopeBindings()
            ->name('rfqs.photos.show');
        Route::put('/rfqs/{rfq}/quote', [QuoteController::class, 'upsert'])->middleware('throttle:quote-submit')->name('rfqs.quote.upsert');
        Route::post('/rfqs/{rfq}/quote/withdraw', [QuoteController::class, 'withdraw'])->middleware('throttle:quote-submit')->name('rfqs.quote.withdraw');
    });

    // Admin (M2c). `admin` runs before route model binding (bootstrap/app.php). Every change is audited.
    Route::middleware('admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/companies', [CompanyController::class, 'index'])->name('companies.index');
        Route::post('/companies/{company}/{transition}', [CompanyController::class, 'transition'])
            ->whereNumber('company')
            ->whereIn('transition', array_column(CompanyTransition::cases(), 'value'))
            ->name('companies.transition');
        Route::post('/users/{user}/suspend', [UserSuspensionController::class, 'suspend'])->whereNumber('user')->name('users.suspend');
        Route::post('/users/{user}/reactivate', [UserSuspensionController::class, 'reactivate'])->whereNumber('user')->name('users.reactivate');
        Route::post('/supplier-categories/{company}/{category}/approve', [AdminSupplierCategoryController::class, 'approve'])
            ->whereNumber(['company', 'category'])->name('supplier-categories.approve');
        Route::post('/supplier-categories/{company}/{category}/reject', [AdminSupplierCategoryController::class, 'reject'])
            ->whereNumber(['company', 'category'])->name('supplier-categories.reject');

        // M4a: triage of "unknown category" RFQs, categories, metrics, audit trail.
        Route::get('/rfqs', [AdminRfqController::class, 'index'])->name('rfqs.index');
        Route::get('/rfqs/{rfq}', [AdminRfqController::class, 'show'])->name('rfqs.show');
        Route::get('/rfqs/{rfq}/photos/{attachment}', [RfqPhotoController::class, 'forAdmin'])
            ->whereNumber('attachment')->scopeBindings()->name('rfqs.photos.show');
        Route::post('/rfqs/{rfq}/triage', [AdminRfqController::class, 'triage'])->name('rfqs.triage');
        Route::post('/rfqs/{rfq}/reject', [AdminRfqController::class, 'reject'])->name('rfqs.reject');
        Route::get('/categories', [AdminCategoryController::class, 'index'])->name('categories.index');
        Route::post('/categories', [AdminCategoryController::class, 'store'])->name('categories.store');
        Route::patch('/categories/{category}', [AdminCategoryController::class, 'update'])->whereNumber('category')->name('categories.update');
        Route::get('/metrics', MetricsController::class)->name('metrics');
        Route::get('/audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');
    });
});
