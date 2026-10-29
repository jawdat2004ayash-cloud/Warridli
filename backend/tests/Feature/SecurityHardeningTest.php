<?php

use App\Enums\CompanyStatus;
use App\Models\Area;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Rfq;
use App\Models\RfqAttachment;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

dataset('unsafe bcrypt inputs', [
    'multibyte input beyond 72 bytes' => [str_repeat('س', 36).'A1'],
    'embedded null byte' => ["abcdef1\0x"],
]);

it('rejects unsafe bcrypt inputs at registration without creating an account', function (string $password) {
    spa()->postJson('/api/auth/register', [
        'name' => 'مستخدم الاختبار',
        'email' => 'security@example.test',
        'password' => $password,
        'password_confirmation' => $password,
        'account_type' => 'buyer',
        'company_name' => 'ورشة الاختبار',
        'whatsapp_phone' => '0944123456',
        'area_id' => Area::factory()->create()->id,
    ])->assertUnprocessable()->assertJsonValidationErrors('password');

    expect(User::query()->count())->toBe(0)
        ->and(Company::query()->count())->toBe(0)
        ->and(AuditLog::query()->count())->toBe(0);
})->with('unsafe bcrypt inputs');

it('rejects unsafe reset passwords without consuming the token or changing the account', function (string $password) {
    Notification::fake();
    $user = User::factory()->create();
    $originalHash = $user->password;
    $originalRemember = $user->remember_token;
    spa()->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk();
    $token = Notification::sent($user, ResetPasswordNotification::class)->sole()->token;
    DB::table('sessions')->insert(['id' => 'security-session', 'user_id' => $user->id, 'payload' => '', 'last_activity' => time()]);

    spa()->postJson('/api/auth/reset-password', [
        'email' => $user->email, 'token' => $token,
        'password' => $password, 'password_confirmation' => $password,
    ])->assertUnprocessable()->assertJsonValidationErrors('password');

    expect($user->refresh()->password)->toBe($originalHash)
        ->and($user->remember_token)->toBe($originalRemember)
        ->and(DB::table('password_reset_tokens')->count())->toBe(1)
        ->and(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'auth.password_reset')->count())->toBe(0);
})->with('unsafe bcrypt inputs');

it('rejects unsafe admin passwords before writing an admin or audit event', function (string $password) {
    $this->artisan('warridli:create-admin', ['email' => 'security-admin@example.test'])
        ->expectsQuestion('Password (min 8 chars, letters and numbers)', $password)
        ->expectsQuestion('Confirm password', $password)
        ->assertFailed();

    expect(User::query()->count())->toBe(0)
        ->and(AuditLog::query()->count())->toBe(0);
})->with('unsafe bcrypt inputs');

it('accepts a multibyte password exactly at the bcrypt byte boundary', function () {
    $password = str_repeat('س', 35).'A1';
    spa()->postJson('/api/auth/register', [
        'name' => 'مستخدم الاختبار', 'email' => 'boundary@example.test',
        'password' => $password, 'password_confirmation' => $password,
        'account_type' => 'buyer', 'company_name' => 'ورشة الاختبار',
        'whatsapp_phone' => '0944123456', 'area_id' => Area::factory()->create()->id,
    ])->assertCreated();

    $user = User::query()->sole();
    expect(Hash::check($password, $user->password))->toBeTrue()
        ->and(Hash::check(str_repeat('س', 35).'B2', $user->password))->toBeFalse();
});

it('does not let a browser cache private photos across sessions or permission changes', function (string $role) {
    Storage::fake('local');
    $buyer = User::factory()->create();
    Company::factory()->ownedBy($buyer)->create();
    $rfq = Rfq::factory()->createdBy($buyer)->create();
    Storage::disk('local')->put('rfq-photos/security.jpg', 'private-photo');
    $photo = new RfqAttachment;
    $photo->forceFill(['rfq_id' => $rfq->id, 'path' => 'rfq-photos/security.jpg', 'mime' => 'image/jpeg', 'size' => 13, 'width' => 1, 'height' => 1])->save();

    $viewer = match ($role) {
        'supplier' => supplierUser(CompanyStatus::Approved, [$rfq->category_id => 'approved']),
        'admin' => User::factory()->admin()->create(),
        default => $buyer,
    };
    $prefix = $role === 'buyer' ? '/api' : "/api/{$role}";
    actAs($viewer);
    $response = spa()->get("{$prefix}/rfqs/{$rfq->ulid}/photos/{$photo->id}")->assertOk();

    expect($response->headers->hasCacheControlDirective('no-store'))->toBeTrue()
        ->and($response->headers->hasCacheControlDirective('private'))->toBeTrue()
        ->and($response->headers->hasCacheControlDirective('max-age'))->toBeFalse()
        ->and($response->streamedContent())->toBe('private-photo');

    asGuest();
    spa()->getJson("{$prefix}/rfqs/{$rfq->ulid}/photos/{$photo->id}")->assertUnauthorized();
})->with(['buyer', 'supplier', 'admin']);
