<?php

use App\Http\Middleware\EnsureApprovedSupplier;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\TokenMismatchException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum SPA cookie auth (A2): session + CSRF for requests from stateful domains.
        $middleware->statefulApi();

        // API only: guests get a JSON 401, never a redirect to a non-existent login route.
        $middleware->redirectGuestsTo(fn (Request $request) => $request->is('api/*') ? null : '/');

        $middleware->alias([
            'active' => EnsureUserIsActive::class,
            'admin' => EnsureUserIsAdmin::class,
            'supplier' => EnsureApprovedSupplier::class,
        ]);

        // Account/admin checks run before route model binding: blocked users and non-admins never learn
        // whether an ID exists. (Authenticate is already ahead of SubstituteBindings by default.)
        $middleware->prependToPriorityList(SubstituteBindings::class, EnsureUserIsActive::class);
        $middleware->prependToPriorityList(SubstituteBindings::class, EnsureUserIsAdmin::class);
        $middleware->prependToPriorityList(SubstituteBindings::class, EnsureApprovedSupplier::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Plain Arabic messages for the generic HTTP errors (422 messages come from lang/ar).
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            return $request->is('api/*')
                ? response()->json(['message' => 'يجب تسجيل الدخول أولاً.'], 401)
                : null;
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            return $request->is('api/*')
                ? response()->json(['message' => 'محاولات كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مرة أخرى.'], 429, $e->getHeaders())
                : null;
        });

        // Whole request bigger than PHP's post_max_size (photos): the body was discarded before Laravel saw it.
        $exceptions->render(function (PostTooLargeException $e, Request $request) {
            return $request->is('api/*')
                ? response()->json(['message' => 'حجم الصور المرفقة كبير جداً. أرفق صوراً أقل أو أصغر ثم أعد الإرسال.'], 413)
                : null;
        });

        $exceptions->render(function (HttpException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $previous = $e->getPrevious();
            $generic = match (true) {
                // CSRF failure: the framework converts TokenMismatchException to a 419 HttpException first.
                $previous instanceof TokenMismatchException => 'انتهت صلاحية الصفحة. حدّث الصفحة ثم حاول مرة أخرى.',
                // Policies' denyAsNotFound() arrive as a plain HttpException(404, 'Not Found').
                $e instanceof NotFoundHttpException, $e->getStatusCode() === 404 && in_array($e->getMessage(), ['', 'Not Found'], true) => 'الصفحة أو العنصر المطلوب غير موجود.',
                // Gate denials without a message of their own; Response::deny('…') messages are Arabic and kept.
                $e instanceof AccessDeniedHttpException && in_array($e->getMessage(), ['', 'This action is unauthorized.'], true) => 'ليست لديك صلاحية للقيام بهذا الإجراء.',
                default => null,
            };

            // Messages we set ourselves via abort() are already user-facing Arabic.
            return $generic === null ? null : response()->json(['message' => $generic], $e->getStatusCode(), $e->getHeaders());
        });
    })->create();
