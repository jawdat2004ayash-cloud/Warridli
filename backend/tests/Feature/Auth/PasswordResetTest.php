<?php

use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

const GENERIC_FORGOT_MESSAGE = 'إذا كان هذا البريد مسجّلاً لدينا فستصلك رسالة فيها رابط لتعيين كلمة مرور جديدة خلال دقائق. تحقّق أيضاً من مجلد الرسائل غير المرغوب فيها.';

beforeEach(function () {
    Notification::fake();
    $this->user = User::factory()->create(['email' => 'owner@example.com', 'password' => Hash::make('oldpass123')]);
});

function requestResetToken(User $user): string
{
    spa()->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk();

    $token = null;
    Notification::assertSentTo($user, ResetPasswordNotification::class, function (ResetPasswordNotification $n) use (&$token) {
        $token = $n->token;

        return true;
    });

    return $token;
}

it('sends a queued Arabic reset link pointing to the SPA, and stores only a hash of the token', function () {
    $token = requestResetToken($this->user);

    $stored = DB::table('password_reset_tokens')->where('email', 'owner@example.com')->value('token');
    expect($stored)->not->toBe($token)
        ->and(Hash::check($token, $stored))->toBeTrue()
        ->and(strlen($token))->toBeGreaterThanOrEqual(40);

    $notification = new ResetPasswordNotification($token);
    $mail = $notification->toMail($this->user);
    expect($notification)->toBeInstanceOf(ShouldQueue::class)
        ->and($mail->actionUrl)->toBe('http://localhost:5173/reset-password?token='.$token.'&email=owner%40example.com')
        ->and($mail->subject)->toContain('إعادة تعيين كلمة المرور');

    expect(AuditLog::query()->where('action', 'auth.password_reset_requested')->where('subject_id', $this->user->id)->exists())->toBeTrue();
});

it('answers identically for unknown emails and sends nothing', function () {
    spa()->postJson('/api/auth/forgot-password', ['email' => 'nobody@example.com'])
        ->assertOk()
        ->assertExactJson(['message' => GENERIC_FORGOT_MESSAGE]);

    Notification::assertNothingSent();
    expect(DB::table('password_reset_tokens')->count())->toBe(0);
});

it('answers identically when the broker throttles a repeated request', function () {
    spa()->postJson('/api/auth/forgot-password', ['email' => 'owner@example.com'])->assertExactJson(['message' => GENERIC_FORGOT_MESSAGE]);
    spa()->postJson('/api/auth/forgot-password', ['email' => 'owner@example.com'])->assertOk()->assertExactJson(['message' => GENERIC_FORGOT_MESSAGE]);

    Notification::assertSentToTimes($this->user, ResetPasswordNotification::class, 1);
});

it('resets the password once, rotates remember token and kills other sessions', function () {
    $other = User::factory()->create();
    $sessions = config('session.table');
    foreach ([[$this->user->id, 's-mine-1'], [$this->user->id, 's-mine-2'], [$other->id, 's-other']] as [$userId, $id]) {
        DB::table($sessions)->insert(['id' => $id, 'user_id' => $userId, 'payload' => '', 'last_activity' => time()]);
    }
    $oldRemember = $this->user->remember_token;
    $token = requestResetToken($this->user);

    spa()->postJson('/api/auth/reset-password', [
        'token' => $token,
        'email' => 'owner@example.com',
        'password' => 'newpass456',
        'password_confirmation' => 'newpass456',
    ])->assertOk()->assertJsonPath('message', 'تم تغيير كلمة المرور. سجّل الدخول بكلمة المرور الجديدة.');

    $this->user->refresh();
    expect(Hash::check('newpass456', $this->user->password))->toBeTrue()
        ->and($this->user->remember_token)->not->toBe($oldRemember)
        ->and(DB::table($sessions)->where('user_id', $this->user->id)->count())->toBe(0)
        ->and(DB::table($sessions)->where('user_id', $other->id)->count())->toBe(1)
        ->and(DB::table('password_reset_tokens')->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'auth.password_reset')->count())->toBe(1);

    // Single use: the same token cannot be replayed.
    spa()->postJson('/api/auth/reset-password', [
        'token' => $token,
        'email' => 'owner@example.com',
        'password' => 'another789',
        'password_confirmation' => 'another789',
    ])->assertUnprocessable()->assertJsonValidationErrors(['token']);

    // And the new password works for login.
    spa()->postJson('/api/auth/login', ['email' => 'owner@example.com', 'password' => 'newpass456'])->assertOk();
});

it('rejects an expired token', function () {
    $token = requestResetToken($this->user);

    $this->travel(61)->minutes();

    spa()->postJson('/api/auth/reset-password', [
        'token' => $token,
        'email' => 'owner@example.com',
        'password' => 'newpass456',
        'password_confirmation' => 'newpass456',
    ])->assertUnprocessable()->assertJsonValidationErrors(['token']);

    expect(Hash::check('oldpass123', $this->user->refresh()->password))->toBeTrue();
});

it('gives one message for a wrong token and for a token used with another email', function () {
    $token = requestResetToken($this->user);
    $victim = User::factory()->create(['email' => 'victim@example.com']);

    $wrongToken = spa()->postJson('/api/auth/reset-password', [
        'token' => str_repeat('a', 64), 'email' => 'owner@example.com',
        'password' => 'newpass456', 'password_confirmation' => 'newpass456',
    ]);
    $otherEmail = spa()->postJson('/api/auth/reset-password', [
        'token' => $token, 'email' => 'victim@example.com',
        'password' => 'newpass456', 'password_confirmation' => 'newpass456',
    ]);
    $unknownEmail = spa()->postJson('/api/auth/reset-password', [
        'token' => $token, 'email' => 'ghost@example.com',
        'password' => 'newpass456', 'password_confirmation' => 'newpass456',
    ]);

    $wrongToken->assertUnprocessable()->assertJsonPath('errors.token.0', 'رابط تعيين كلمة المرور غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً.');
    expect($otherEmail->json())->toBe($wrongToken->json())
        ->and($unknownEmail->json())->toBe($wrongToken->json())
        ->and(Hash::check('newpass456', $victim->refresh()->password))->toBeFalse();
});

it('enforces password rules on reset', function () {
    $token = requestResetToken($this->user);

    spa()->postJson('/api/auth/reset-password', [
        'token' => $token, 'email' => 'owner@example.com',
        'password' => '12345678', 'password_confirmation' => '12345678',
    ])->assertUnprocessable()->assertJsonPath('errors.password.0', 'كلمة المرور يجب أن تحتوي على حرف واحد على الأقل.');
});
