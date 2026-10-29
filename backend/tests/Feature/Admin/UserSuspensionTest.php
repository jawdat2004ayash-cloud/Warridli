<?php

use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->user = User::factory()->create(['email' => 'buyer@example.com', 'password' => Hash::make('secret123abc')]);
    Company::factory()->ownedBy($this->user)->create();
});

function userAction(User $target, string $action, array $body = []): TestResponse
{
    actAs(test()->admin);

    return spa()->postJson("/api/admin/users/{$target->id}/{$action}", $body);
}

it('suspends a user with a reason, audits it, and the user is out on the next request', function () {
    $oldRememberToken = $this->user->remember_token;

    userAction($this->user, 'suspend', ['reason' => 'انتحال صفة شركة أخرى'])
        ->assertOk()
        ->assertExactJson(['data' => ['id' => $this->user->id, 'name' => $this->user->name, 'suspended' => true]]);

    $this->user->refresh();
    expect($this->user->isSuspended())->toBeTrue()
        ->and($this->user->remember_token)->not->toBe($oldRememberToken);

    $log = AuditLog::query()->where('action', 'user.suspended')->sole();
    expect($log->actor_user_id)->toBe($this->admin->id)
        ->and([$log->subject_type, $log->subject_id])->toBe(['user', $this->user->id])
        ->and($log->meta)->toBe(['reason' => 'انتحال صفة شركة أخرى', 'sessions_revoked' => 0])
        ->and(json_encode($log->meta))->not->toContain('password');

    actAs($this->user);
    spa()->getJson('/api/me')->assertForbidden()->assertJsonPath('message', 'هذا الحساب موقوف. تواصل مع إدارة ورّدلي لمعرفة السبب.');
    $this->assertGuest('web');
});

it('requires a reason to suspend', function () {
    userAction($this->user, 'suspend', ['reason' => ''])->assertUnprocessable()->assertJsonPath('errors.reason.0', 'حقل السبب مطلوب.');
    userAction($this->user, 'suspend', ['reason' => 'لا'])->assertUnprocessable()->assertJsonPath('errors.reason.0', 'السبب يجب أن يكون 5 أحرف على الأقل.');

    expect($this->user->refresh()->isSuspended())->toBeFalse();
});

it('deletes all stored sessions of the suspended user', function () {
    config(['session.driver' => 'database']);
    DB::table('sessions')->insert(['id' => 'victim-session', 'user_id' => $this->user->id, 'payload' => '', 'last_activity' => time()]);

    userAction($this->user, 'suspend', ['reason' => 'سلوك مسيء'])->assertOk();

    expect(DB::table('sessions')->where('user_id', $this->user->id)->exists())->toBeFalse()
        ->and(AuditLog::query()->where('action', 'user.suspended')->sole()->meta['sessions_revoked'])->toBe(1);
});

it('reactivates a suspended user, who can then log in again', function () {
    $this->user->forceFill(['suspended_at' => now()])->save();

    userAction($this->user, 'reactivate')->assertOk()->assertJsonPath('data.suspended', false);

    asGuest();
    spa()->postJson('/api/auth/login', ['email' => 'buyer@example.com', 'password' => 'secret123abc'])->assertOk();
    expect(AuditLog::query()->where('action', 'user.reactivated')->count())->toBe(1);
});

it('refuses conflicting suspension requests with an Arabic 409', function () {
    userAction($this->user, 'reactivate')->assertStatus(409)->assertJsonPath('message', 'هذا الحساب مفعّل مسبقاً وغير موقوف.');

    $this->user->forceFill(['suspended_at' => now()])->save();
    userAction($this->user, 'suspend', ['reason' => 'مرة ثانية'])->assertStatus(409)->assertJsonPath('message', 'هذا الحساب موقوف مسبقاً.');

    expect(AuditLog::query()->where('action', 'like', 'user.%')->count())->toBe(0);
});

it('never suspends an admin account, including the acting admin', function () {
    $otherAdmin = User::factory()->admin()->create();

    userAction($this->admin, 'suspend', ['reason' => 'اختبار القفل الذاتي'])->assertStatus(409)
        ->assertJsonPath('message', 'حسابات المدراء لا تُدار من هذه الواجهة.');
    userAction($otherAdmin, 'suspend', ['reason' => 'اختبار مدير آخر'])->assertStatus(409);

    expect($this->admin->refresh()->isSuspended())->toBeFalse()
        ->and($otherAdmin->refresh()->isSuspended())->toBeFalse();
});

it('forbids non-admins from suspending anyone, including for IDs that do not exist', function () {
    $attacker = User::factory()->create();
    Company::factory()->supplier()->ownedBy($attacker)->create();
    $this->actingAs($attacker);

    spa()->postJson("/api/admin/users/{$this->user->id}/suspend", ['reason' => 'محاولة غير مصرح بها'])->assertForbidden();
    spa()->postJson("/api/admin/users/{$this->admin->id}/suspend", ['reason' => 'محاولة غير مصرح بها'])->assertForbidden();
    spa()->postJson('/api/admin/users/999999/suspend', ['reason' => 'محاولة غير مصرح بها'])->assertForbidden();

    expect($this->user->refresh()->isSuspended())->toBeFalse()
        ->and(AuditLog::query()->where('action', 'like', 'user.%')->count())->toBe(0);
});

it('answers unknown users with an Arabic 404 for admins', function () {
    $this->actingAs($this->admin);

    spa()->postJson('/api/admin/users/999999/suspend', ['reason' => 'غير موجود'])->assertNotFound()
        ->assertJsonPath('message', 'الصفحة أو العنصر المطلوب غير موجود.');
});
