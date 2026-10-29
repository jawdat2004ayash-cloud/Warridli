<?php

use App\Enums\CompanyStatus;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

beforeEach(function () {
    // Stand-in for the supplier endpoints of M3b, with the middleware stack they will use.
    Route::middleware(['api', 'auth:sanctum', 'active', 'can:approved-supplier'])
        ->get('/api/__test/supplier-only', fn () => response()->json(['ok' => true]));
});

function supplierWith(CompanyStatus $status): User
{
    $user = User::factory()->create();
    Company::factory()->supplier($status)->ownedBy($user)->create();

    return $user;
}

it('lets only approved suppliers use supplier features', function () {
    $this->actingAs(supplierWith(CompanyStatus::Approved));

    spa()->getJson('/api/__test/supplier-only')->assertOk();
});

it('explains in Arabic why a non-approved account cannot use supplier features', function (string $status, string $message) {
    $this->actingAs(supplierWith(CompanyStatus::from($status)));

    spa()->getJson('/api/__test/supplier-only')->assertForbidden()->assertJsonPath('message', $message);
})->with([
    'pending' => ['pending', 'حساب المورّد قيد المراجعة. ستتمكن من استخدام هذه الميزة بعد موافقة إدارة ورّدلي.'],
    'rejected' => ['rejected', 'لم تتم الموافقة على حساب المورّد. تواصل مع إدارة ورّدلي لمعرفة التفاصيل.'],
    'suspended' => ['suspended', 'حساب شركتك موقوف حالياً. تواصل مع إدارة ورّدلي لمعرفة السبب.'],
]);

it('denies buyers and admins (who have no supplier company)', function () {
    $buyer = User::factory()->create();
    Company::factory()->ownedBy($buyer)->create();

    $this->actingAs($buyer);
    spa()->getJson('/api/__test/supplier-only')->assertForbidden()->assertJsonPath('message', 'هذه الميزة متاحة للمورّدين المعتمدين فقط.');

    actAs(User::factory()->admin()->create());
    spa()->getJson('/api/__test/supplier-only')->assertForbidden();
});

it('opens supplier features right after an admin approves the company, and closes them on suspension', function () {
    $supplier = supplierWith(CompanyStatus::Pending);
    $company = $supplier->company();
    $admin = User::factory()->admin()->create();

    $this->actingAs($supplier);
    spa()->getJson('/api/__test/supplier-only')->assertForbidden();

    actAs($admin);
    spa()->postJson("/api/admin/companies/{$company->id}/approve")->assertOk();

    actAs($supplier);
    spa()->getJson('/api/__test/supplier-only')->assertOk();

    actAs($admin);
    spa()->postJson("/api/admin/companies/{$company->id}/suspend", ['reason' => 'شكاوى متكررة'])->assertOk();

    actAs($supplier);
    spa()->getJson('/api/__test/supplier-only')->assertForbidden();
});
