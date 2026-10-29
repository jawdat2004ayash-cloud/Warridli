<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\MeResource;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class SessionController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Log in with email + password. Unknown email and wrong password give the same answer;
     * SessionGuard::attempt() runs inside a Timebox, so response time does not reveal which.
     */
    public function store(LoginRequest $request): MeResource
    {
        // Sanctum only starts a session for requests from the SPA's stateful domains.
        abort_unless($request->hasSession(), 400, 'تعذّر بدء الجلسة. افتح ورّدلي من المتصفح وحاول مرة أخرى.');

        $credentials = $request->only('email', 'password');

        if (! Auth::guard('web')->attempt($credentials)) {
            throw ValidationException::withMessages([
                'email' => 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
            ]);
        }

        /** @var User $user */
        $user = Auth::guard('web')->user();

        $blocked = $user->accessBlockedMessage();
        if ($blocked !== null) {
            $this->endSession($request);
            abort(403, $blocked);
        }

        $request->session()->regenerate();
        $this->audit->record('auth.login', $user, [], $user);

        return MeResource::for($user);
    }

    public function destroy(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $this->audit->record('auth.logout', $user, [], $user);

        $this->endSession($request);

        return response()->noContent();
    }

    private function endSession(Request $request): void
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }
}
