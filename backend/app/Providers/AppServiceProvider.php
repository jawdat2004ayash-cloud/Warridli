<?php

namespace App\Providers;

use App\Enums\CompanyStatus;
use App\Enums\CompanyType;
use App\Models\Category;
use App\Models\Company;
use App\Models\Quote;
use App\Models\Rfq;
use App\Models\User;
use App\Support\TestDatabaseSafety;
use Closure;
use Illuminate\Auth\Access\Response;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Outside production: fail loudly on lazy loading (N+1), silently discarded attributes,
        // and access to missing attributes.
        Model::shouldBeStrict(! $this->app->isProduction());

        // Block migrate:fresh / db:wipe / migrate:reset in production.
        DB::prohibitDestructiveCommands($this->app->isProduction());

        // Browser e2e runs (APP_ENV=e2e, see frontend/playwright.config.ts) must never touch the dev database.
        if ($this->app->environment('e2e')) {
            TestDatabaseSafety::ensure();
        }

        // Short, stable type names in audit_logs (and later notifications) instead of class names.
        Relation::enforceMorphMap([
            'user' => User::class,
            'company' => Company::class,
            'rfq' => Rfq::class,
            'quote' => Quote::class,
            'category' => Category::class,
        ]);

        // Bcrypt's limit is bytes, not characters. Reject ignored suffixes and unhashable NUL input
        // consistently for registration, password reset and the admin CLI.
        Password::defaults(fn () => Password::min(8)->max(72)->letters()->numbers()->rules([
            static function (string $attribute, mixed $value, Closure $fail): void {
                if (! is_string($value)) {
                    return;
                }
                if (strlen($value) > 72) {
                    $fail('كلمة المرور طويلة جداً. قصّرها، خصوصاً إذا استخدمت أحرفاً عربية.');
                }
                if (str_contains($value, "\0")) {
                    $fail('كلمة المرور تحتوي على محرف غير مسموح.');
                }
            },
        ]));

        Gate::define('admin', fn (User $user) => $user->is_admin && ! $user->isSuspended());

        // For the supplier features of M3b (`can:approved-supplier`): only a supplier company an admin approved.
        Gate::define('approved-supplier', function (User $user): Response {
            $company = $user->company();

            if ($company === null || $company->type !== CompanyType::Supplier) {
                return Response::deny('هذه الميزة متاحة للمورّدين المعتمدين فقط.');
            }

            return match ($company->status) {
                CompanyStatus::Approved => Response::allow(),
                CompanyStatus::Pending => Response::deny('حساب المورّد قيد المراجعة. ستتمكن من استخدام هذه الميزة بعد موافقة إدارة ورّدلي.'),
                CompanyStatus::Rejected => Response::deny('لم تتم الموافقة على حساب المورّد. تواصل مع إدارة ورّدلي لمعرفة التفاصيل.'),
                CompanyStatus::Suspended => Response::deny('حساب شركتك موقوف حالياً. تواصل مع إدارة ورّدلي لمعرفة السبب.'),
            };
        });

        $this->configureRateLimiting();
    }

    /**
     * Limits are generous per IP because many workshops share one carrier-grade NAT address.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by('login:'.self::emailKey($request).'|'.$request->ip()),
            Limit::perMinute(30)->by('login-ip:'.$request->ip()),
        ]);

        RateLimiter::for('register', fn (Request $request) => [
            Limit::perMinute(5)->by('register:'.$request->ip()),
            Limit::perHour(30)->by('register-hour:'.$request->ip()),
        ]);

        // The password broker additionally allows one reset email per address per 60 s.
        RateLimiter::for('password-reset', fn (Request $request) => [
            Limit::perMinute(3)->by('pwreset:'.self::emailKey($request).'|'.$request->ip()),
            Limit::perMinute(10)->by('pwreset-ip:'.$request->ip()),
        ]);

        // D27: a workshop rarely needs more than a few requests in a row; the daily cap is per user.
        RateLimiter::for('rfq-create', fn (Request $request) => [
            Limit::perMinute(5)->by('rfq-min:'.$request->user()?->getAuthIdentifier()),
            Limit::perDay(40)->by('rfq-day:'.$request->user()?->getAuthIdentifier()),
        ]);

        // Quote submit/edit/withdraw (D31): generous for real editing, stops scripted spam.
        RateLimiter::for('quote-submit', fn (Request $request) => [
            Limit::perMinute(20)->by('quote-min:'.$request->user()?->getAuthIdentifier()),
            Limit::perDay(300)->by('quote-day:'.$request->user()?->getAuthIdentifier()),
        ]);

        // Revealing supplier numbers (D33): plenty for comparing a few suppliers, stops harvesting.
        RateLimiter::for('contact', fn (Request $request) => [
            Limit::perMinute(20)->by('contact-min:'.$request->user()?->getAuthIdentifier()),
            Limit::perDay(200)->by('contact-day:'.$request->user()?->getAuthIdentifier()),
        ]);

        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)
            ->by($request->user()?->getAuthIdentifier() ?? $request->ip()));
    }

    private static function emailKey(Request $request): string
    {
        $email = $request->input('email');

        return is_string($email) ? mb_strtolower(trim($email)) : '';
    }
}
