<?php

use App\Enums\CompanyStatus;
use App\Models\Area;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

/**
 * @return array<string, mixed>
 */
function registrationPayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'أبو خالد',
        'email' => 'khaled@example.com',
        'password' => 'ورشة2026abc',
        'password_confirmation' => 'ورشة2026abc',
        'account_type' => 'buyer',
        'company_name' => 'ورشة الأمل للصيانة',
        'whatsapp_phone' => '0944123456',
        'area_id' => Area::factory()->create()->id,
        'address_text' => 'شارع المعامل',
    ], $overrides);
}

it('registers a buyer with an approved company and logs them in', function () {
    $response = spa()->postJson('/api/auth/register', registrationPayload());

    $response->assertCreated()
        ->assertJsonPath('data.email', 'khaled@example.com')
        ->assertJsonPath('data.is_admin', false)
        ->assertJsonPath('data.company.type', 'buyer')
        ->assertJsonPath('data.company.status', 'approved')
        ->assertJsonPath('data.company.role', 'owner')
        ->assertJsonPath('data.company.whatsapp_phone', '+963944123456')
        ->assertJsonMissingPath('data.password')
        ->assertJsonMissingPath('data.remember_token');

    $user = User::query()->where('email', 'khaled@example.com')->firstOrFail();
    expect(Hash::check('ورشة2026abc', $user->password))->toBeTrue()
        ->and($user->password)->not->toBe('ورشة2026abc');

    $this->assertAuthenticatedAs($user, 'web');
    expect(AuditLog::query()->where('action', 'auth.registered')->where('subject_id', $user->id)->exists())->toBeTrue();
});

it('registers a supplier whose company waits for admin vetting', function () {
    spa()->postJson('/api/auth/register', registrationPayload(['account_type' => 'supplier']))
        ->assertCreated()
        ->assertJsonPath('data.company.type', 'supplier')
        ->assertJsonPath('data.company.status', 'pending');
});

it('ignores privilege fields smuggled into the payload', function () {
    spa()->postJson('/api/auth/register', registrationPayload([
        'account_type' => 'supplier',
        'is_admin' => true,
        'status' => 'approved',
        'suspended_at' => null,
        'role' => 'member',
        'verified_by' => 1,
    ]))->assertCreated();

    $user = User::query()->where('email', 'khaled@example.com')->firstOrFail();
    $company = Company::query()->sole();

    expect($user->is_admin)->toBeFalse()
        ->and($company->status)->toBe(CompanyStatus::Pending)
        ->and($company->verified_by)->toBeNull();
});

it('normalizes phone numbers typed with Arabic digits and spaces', function () {
    spa()->postJson('/api/auth/register', registrationPayload(['whatsapp_phone' => '٠٩٤٤ ١٢٣ ٤٥٦']))
        ->assertCreated()
        ->assertJsonPath('data.company.whatsapp_phone', '+963944123456');
});

it('rejects a non-Syrian or malformed phone with a clear Arabic message', function (string $phone) {
    spa()->postJson('/api/auth/register', registrationPayload(['whatsapp_phone' => $phone]))
        ->assertUnprocessable()
        ->assertJsonPath('errors.whatsapp_phone.0', 'رقم الواتساب غير صحيح. اكتب رقم موبايل سوري مثل 0944123456.');
})->with(['011 2223344', '+44 7700 900123', 'abc', '0944']);

it('returns Arabic validation messages for missing fields', function () {
    $response = spa()->postJson('/api/auth/register', []);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['name', 'email', 'password', 'account_type', 'company_name', 'whatsapp_phone', 'area_id']);

    expect($response->json('errors.name.0'))->toBe('حقل الاسم مطلوب.')
        ->and($response->json('errors.company_name.0'))->toBe('حقل اسم المنشأة مطلوب.');
});

it('rejects weak passwords, mismatched confirmation, unknown account types and areas', function () {
    $response = spa()->postJson('/api/auth/register', registrationPayload([
        'password' => 'abcdefgh',
        'password_confirmation' => 'different1',
        'account_type' => 'admin',
        'area_id' => 999999,
    ]));

    $response->assertUnprocessable()->assertJsonValidationErrors(['password', 'account_type', 'area_id']);
    expect(User::query()->count())->toBe(0);
});

it('rejects an email that is already registered, case-insensitively', function () {
    User::factory()->create(['email' => 'khaled@example.com']);

    spa()->postJson('/api/auth/register', registrationPayload(['email' => '  KHALED@Example.com ']))
        ->assertUnprocessable()
        ->assertJsonPath('errors.email.0', 'هذا البريد مسجّل مسبقاً. جرّب تسجيل الدخول أو استعادة كلمة المرور.');

    expect(Company::query()->count())->toBe(0);
});

it('refuses to register while already logged in', function () {
    $this->actingAs(User::factory()->create());

    spa()->postJson('/api/auth/register', registrationPayload())->assertStatus(409);
    expect(User::query()->count())->toBe(1);
});

it('refuses registration from a non-SPA origin without creating anything', function () {
    $this->postJson('/api/auth/register', registrationPayload())->assertStatus(400);

    expect(User::query()->count())->toBe(0);
});
