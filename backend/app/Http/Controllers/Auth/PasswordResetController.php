<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * D5: Laravel password broker only — random token stored hashed, 60 min, single-use,
 * throttled per email, identical answer for unknown emails, other sessions killed after reset.
 */
class PasswordResetController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function sendLink(ForgotPasswordRequest $request): JsonResponse
    {
        $status = Password::broker()->sendResetLink($request->only('email'));

        if ($status === Password::RESET_LINK_SENT) {
            $user = User::query()->where('email', $request->string('email')->value())->first();
            $this->audit->record('auth.password_reset_requested', $user);
        }

        // Same body and status whether the email exists, is unknown, or was throttled.
        return response()->json([
            'message' => 'إذا كان هذا البريد مسجّلاً لدينا فستصلك رسالة فيها رابط لتعيين كلمة مرور جديدة خلال دقائق. تحقّق أيضاً من مجلد الرسائل غير المرغوب فيها.',
        ]);
    }

    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::broker()->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, #[\SensitiveParameter] string $password): void {
                DB::transaction(function () use ($user, $password) {
                    $user->forceFill([
                        'password' => $password,
                        'remember_token' => Str::random(60),
                    ])->save();

                    // Log out every existing session of this user (database session driver).
                    DB::table((string) config('session.table', 'sessions'))->where('user_id', $user->id)->delete();

                    $this->audit->record('auth.password_reset', $user, [], $user);
                });

                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            // Invalid, expired, already-used token, or unknown email: one message for all.
            throw ValidationException::withMessages([
                'token' => 'رابط تعيين كلمة المرور غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً.',
            ]);
        }

        return response()->json([
            'message' => 'تم تغيير كلمة المرور. سجّل الدخول بكلمة المرور الجديدة.',
        ]);
    }
}
