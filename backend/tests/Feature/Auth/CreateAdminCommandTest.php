<?php

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

const PW_PROMPT = 'Password (min 8 chars, letters and numbers)';

it('creates an admin from hidden prompts without printing the password', function () {
    $this->artisan('warridli:create-admin', ['email' => ' Admin@Example.com', '--name' => 'مدير ورّدلي'])
        ->expectsQuestion(PW_PROMPT, 'Str0ngAdminPass')
        ->expectsQuestion('Confirm password', 'Str0ngAdminPass')
        ->expectsOutput('Admin account created for admin@example.com.')
        ->doesntExpectOutputToContain('Str0ngAdminPass')
        ->assertSuccessful();

    $admin = User::query()->where('email', 'admin@example.com')->firstOrFail();
    expect($admin->is_admin)->toBeTrue()
        ->and($admin->name)->toBe('مدير ورّدلي')
        ->and($admin->password)->not->toBe('Str0ngAdminPass')
        ->and(Hash::check('Str0ngAdminPass', $admin->password))->toBeTrue()
        ->and(AuditLog::query()->where('action', 'admin.created')->where('subject_id', $admin->id)->exists())->toBeTrue();
});

it('refuses mismatched or weak passwords', function (string $password, string $confirmation) {
    $this->artisan('warridli:create-admin', ['email' => 'admin@example.com'])
        ->expectsQuestion(PW_PROMPT, $password)
        ->expectsQuestion('Confirm password', $confirmation)
        ->assertFailed();

    expect(User::query()->count())->toBe(0);
})->with([
    'mismatch' => ['Str0ngAdminPass', 'Str0ngAdminPas'],
    'too short' => ['abc123', 'abc123'],
    'no numbers' => ['onlyletters', 'onlyletters'],
]);

it('never promotes an existing account', function () {
    $existing = User::factory()->create(['email' => 'buyer@example.com']);

    $this->artisan('warridli:create-admin', ['email' => 'buyer@example.com'])->assertFailed();

    expect($existing->refresh()->is_admin)->toBeFalse();
});

it('refuses an invalid email', function () {
    $this->artisan('warridli:create-admin', ['email' => 'not-an-email'])->assertFailed();
});

it('refuses to run non-interactively', function () {
    $this->artisan('warridli:create-admin', ['email' => 'admin@example.com', '--no-interaction' => true])->assertFailed();

    expect(User::query()->count())->toBe(0);
});
