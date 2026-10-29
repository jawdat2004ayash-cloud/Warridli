<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

const THROTTLE_MESSAGE = 'محاولات كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مرة أخرى.';

it('throttles repeated login attempts for the same email', function () {
    User::factory()->create(['email' => 'target@example.com']);

    foreach (range(1, 5) as $_) {
        spa()->postJson('/api/auth/login', ['email' => 'target@example.com', 'password' => 'wrong1234'])->assertUnprocessable();
    }

    spa()->postJson('/api/auth/login', ['email' => 'TARGET@example.com', 'password' => 'wrong1234'])
        ->assertTooManyRequests()
        ->assertHeader('Retry-After')
        ->assertExactJson(['message' => THROTTLE_MESSAGE]);
});

it('throttles password reset requests', function () {
    foreach (range(1, 3) as $_) {
        spa()->postJson('/api/auth/forgot-password', ['email' => 'someone@example.com'])->assertOk();
    }

    spa()->postJson('/api/auth/forgot-password', ['email' => 'someone@example.com'])->assertTooManyRequests();
});

it('throttles password reset submissions', function () {
    $payload = ['token' => 'x', 'email' => 'someone@example.com', 'password' => 'newpass456', 'password_confirmation' => 'newpass456'];

    foreach (range(1, 3) as $_) {
        spa()->postJson('/api/auth/reset-password', $payload)->assertUnprocessable();
    }

    spa()->postJson('/api/auth/reset-password', $payload)->assertTooManyRequests();
});

it('throttles registration per IP', function () {
    foreach (range(1, 5) as $_) {
        spa()->postJson('/api/auth/register', [])->assertUnprocessable();
    }

    spa()->postJson('/api/auth/register', [])->assertTooManyRequests();
});
