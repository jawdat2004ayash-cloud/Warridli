<?php

use App\Enums\CompanyStatus;
use App\Enums\QuoteStatus;
use App\Models\Company;
use App\Models\Quote;
use App\Models\Rfq;
use App\Models\SupplierCategory;
use App\Models\User;
use Tests\TestCase;

/*
| Feature tests boot the app against the real MariaDB test schema (warridli_test).
| Files that write to the database opt in with: uses(RefreshDatabase::class);
| Unit tests stay framework-free.
*/
pest()->extend(TestCase::class)->in('Feature');

/**
 * A request as the SPA sends it through the Vite proxy. Sanctum only starts a session
 * (and thus allows login) for requests whose Origin/Referer is a stateful domain.
 */
/**
 * Act as $user from their own browser: fresh model, no cached guard user, empty session. Needed when one test
 * switches between users — otherwise Sanctum's AuthenticateSession sees the previous user's password hash
 * in the shared test session and logs the new one out (401).
 */
function actAs(User $user): void
{
    asGuest();
    test()->actingAs($user->fresh() ?? $user);
}

/**
 * A new browser with no session at all.
 */
function asGuest(): void
{
    app('auth')->forgetGuards();
    app('session')->driver()->flush();
}

/**
 * A user owning a supplier company with the given specialties (category => 'approved'|'pending').
 *
 * @param  array<int, string>  $specialties  category id => status
 */
function supplierUser(CompanyStatus $status = CompanyStatus::Approved, array $specialties = []): User
{
    $user = User::factory()->create();
    $company = Company::factory()->supplier($status)->ownedBy($user)->create();
    foreach ($specialties as $categoryId => $specialtyStatus) {
        $row = new SupplierCategory;
        $row->forceFill(['company_id' => $company->id, 'category_id' => $categoryId, 'status' => $specialtyStatus])->save();
    }

    return $user;
}

/**
 * A valid quote body; override fields per test.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function quotePayload(array $overrides = []): array
{
    return array_merge([
        'unit_price' => '125000.50',
        'currency' => 'SYP',
        'condition' => 'new',
        'brand' => 'SKF',
        'origin' => 'السويد',
        'stock_status' => 'in_stock',
        'lead_time_days' => null,
        'fulfillment' => 'pickup',
        'valid_until' => now('Asia/Damascus')->addDays(7)->toDateString(),
        'notes' => 'أصلية مع فاتورة',
    ], $overrides);
}

/**
 * A stored quote from $supplier on $rfq, bypassing the supplier API (that flow is covered in QuoteTest).
 *
 * @param  array<string, mixed>  $attrs
 */
function storedQuote(User $supplier, Rfq $rfq, array $attrs = []): Quote
{
    $quote = new Quote;
    $quote->forceFill(array_merge([
        'rfq_id' => $rfq->id,
        'supplier_company_id' => $supplier->company()?->id,
        'submitted_by' => $supplier->id,
        'unit_price' => '100000.00',
        'currency' => 'SYP',
        'condition' => 'new',
        'stock_status' => 'in_stock',
        'lead_time_days' => 0,
        'fulfillment' => 'pickup',
        'valid_until' => now('Asia/Damascus')->addDays(5)->toDateString(),
        'status' => QuoteStatus::Submitted,
    ], $attrs))->save();

    return $quote->refresh();
}

/**
 * A fresh admin browser session, ready for SPA JSON requests.
 */
function asAdminUser(User $admin): TestCase
{
    actAs($admin);

    return spa();
}

function spa(): TestCase
{
    return test()->withHeaders([
        'Origin' => 'http://localhost:5173',
        'Referer' => 'http://localhost:5173/',
        'Accept' => 'application/json',
    ]);
}
