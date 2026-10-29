<?php

use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create([
        'email' => 'buyer@example.com',
        'password' => Hash::make('secret123abc'),
    ]);
    Company::factory()->ownedBy($this->user)->create(['name' => 'ورشة النور']);
});

it('logs in with valid credentials and returns only the allow-listed profile', function () {
    $response = spa()->postJson('/api/auth/login', ['email' => ' Buyer@Example.com ', 'password' => 'secret123abc']);

    $response->assertOk()->assertJsonPath('data.company.name', 'ورشة النور');
    expect(array_keys($response->json('data')))->toBe(['id', 'name', 'email', 'is_admin', 'company'])
        ->and(array_keys($response->json('data.company')))->toBe(['id', 'type', 'name', 'whatsapp_phone', 'area', 'address_text', 'status', 'role']);

    $this->assertAuthenticatedAs($this->user, 'web');
    expect(AuditLog::query()->where('action', 'auth.login')->count())->toBe(1);
});

it('gives the same answer for a wrong password and an unknown email', function () {
    $wrongPassword = spa()->postJson('/api/auth/login', ['email' => 'buyer@example.com', 'password' => 'nope12345']);
    $unknownEmail = spa()->postJson('/api/auth/login', ['email' => 'ghost@example.com', 'password' => 'nope12345']);

    $wrongPassword->assertUnprocessable()->assertJsonPath('errors.email.0', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    expect($unknownEmail->status())->toBe($wrongPassword->status())
        ->and($unknownEmail->json())->toBe($wrongPassword->json());
    $this->assertGuest('web');
});

it('blocks a suspended user even with the correct password', function () {
    $this->user->forceFill(['suspended_at' => now()])->save();

    spa()->postJson('/api/auth/login', ['email' => 'buyer@example.com', 'password' => 'secret123abc'])
        ->assertForbidden()
        ->assertJsonPath('message', 'هذا الحساب موقوف. تواصل مع إدارة ورّدلي لمعرفة السبب.');

    $this->assertGuest('web');
});

it('refuses login from a non-SPA origin (no session) with a clear error instead of crashing', function () {
    $this->postJson('/api/auth/login', ['email' => 'buyer@example.com', 'password' => 'secret123abc'])
        ->assertStatus(400);
});

it('validates the login payload', function () {
    spa()->postJson('/api/auth/login', ['email' => ['x'], 'password' => ''])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email', 'password']);
});

it('returns the current user on /me and 401 in Arabic for guests', function () {
    $this->getJson('/api/me')->assertUnauthorized()->assertExactJson(['message' => 'يجب تسجيل الدخول أولاً.']);

    // Without an Accept header too: JSON 401, never a redirect.
    $this->get('/api/me')->assertUnauthorized();

    $this->actingAs($this->user);
    spa()->getJson('/api/me')->assertOk()->assertJsonPath('data.id', $this->user->id);
});

it('shows each user only their own profile and company', function () {
    $other = User::factory()->create(['email' => 'rival@example.com']);
    Company::factory()->supplier()->ownedBy($other)->create(['name' => 'مورّد منافس']);

    $this->actingAs($this->user);
    $response = spa()->getJson('/api/me?user_id='.$other->id.'&id='.$other->id);

    $response->assertOk()->assertJsonPath('data.id', $this->user->id);
    expect($response->getContent())->not->toContain('rival@example.com')
        ->and($response->getContent())->not->toContain('مورّد منافس')
        ->and($response->getContent())->not->toContain($this->user->password);
});

it('logs out and invalidates the session', function () {
    $this->actingAs($this->user);

    spa()->postJson('/api/auth/logout')->assertNoContent();
    $this->assertGuest('web');
    expect(AuditLog::query()->where('action', 'auth.logout')->count())->toBe(1);

    // The test app is long-lived: drop guard instances (Sanctum's RequestGuard caches its user),
    // as a real new request would. The real cookie round-trip is covered by the M2b browser test.
    $this->app['auth']->forgetGuards();
    spa()->getJson('/api/me')->assertUnauthorized();
});

it('rejects logout for guests', function () {
    spa()->postJson('/api/auth/logout')->assertUnauthorized();
});

it('logs out a user who was suspended mid-session', function () {
    $this->user->forceFill(['suspended_at' => now()])->save();
    $this->actingAs($this->user);

    spa()->getJson('/api/me')->assertForbidden();
    $this->assertGuest('web');
});

it('returns admin accounts without a company', function () {
    $this->actingAs(User::factory()->admin()->create());

    spa()->getJson('/api/me')->assertOk()
        ->assertJsonPath('data.is_admin', true)
        ->assertJsonPath('data.company', null);
});
