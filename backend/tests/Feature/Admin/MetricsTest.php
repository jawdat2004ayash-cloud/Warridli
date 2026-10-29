<?php

use App\Enums\CompanyStatus;
use App\Enums\QuoteStatus;
use App\Enums\RfqStatus;
use App\Models\Category;
use App\Models\Company;
use App\Models\ContactEvent;
use App\Models\Rfq;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

/**
 * An RFQ created at $created (forceFill so the timestamp is exactly what the test says).
 */
function rfqAt(User $buyer, Carbon $created, array $attrs = []): Rfq
{
    $rfq = Rfq::factory()->createdBy($buyer)->make($attrs);
    $rfq->forceFill(['created_at' => $created, 'updated_at' => $created])->save();

    return $rfq;
}

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-30 12:00:00'));
    $this->admin = User::factory()->admin()->create();
    $this->category = Category::factory()->create();
    $this->buyer = User::factory()->create();
    Company::factory()->ownedBy($this->buyer)->create();
    $this->supplierA = supplierUser(CompanyStatus::Approved, [$this->category->id => 'approved']);
    $this->supplierB = supplierUser(CompanyStatus::Approved, [$this->category->id => 'approved']);
    $cat = ['category_id' => $this->category->id];

    // 1) 10 days ago: first quote after 2 h (a second one later), chosen.
    $a = rfqAt($this->buyer, now()->subDays(10), $cat);
    storedQuote($this->supplierA, $a)->forceFill(['created_at' => now()->subDays(10)->addHours(2)])->save();
    $chosen = storedQuote($this->supplierB, $a);
    $chosen->forceFill(['created_at' => now()->subDays(9)])->save();
    $a->forceFill(['status' => RfqStatus::Closed, 'selected_quote_id' => $chosen->id])->save();
    // 2) 3 days ago: one quote after 30 min, withdrawn later — still "received a quote".
    $b = rfqAt($this->buyer, now()->subDays(3), $cat);
    storedQuote($this->supplierA, $b, ['status' => QuoteStatus::Withdrawn])->forceFill(['created_at' => now()->subDays(3)->addMinutes(30)])->save();
    // 3) open, no quote yet.
    rfqAt($this->buyer, now()->subDays(2), $cat);
    // 4) unknown category, still waiting; 5) unknown category, triaged after 90 min; 6) rejected spam.
    rfqAt($this->buyer, now()->subDay(), ['category_id' => null, 'status' => RfqStatus::PendingReview]);
    rfqAt($this->buyer, now()->subDays(5), ['triaged_at' => now()->subDays(5)->addMinutes(90)]);
    rfqAt($this->buyer, now()->subDays(4), ['category_id' => null, 'status' => RfqStatus::Rejected, 'triaged_at' => now()->subDays(4)->addMinutes(30)]);
    // 7) 40 days ago with a quote after 10 h — outside the 30-day period.
    $old = rfqAt($this->buyer, now()->subDays(40), $cat);
    storedQuote($this->supplierB, $old)->forceFill(['created_at' => now()->subDays(40)->addHours(10)])->save();

    // Contact reveals: 2 on RFQ 1 (in period), 1 on the old RFQ 40 days ago.
    foreach ([[$a, $chosen, now()->subDays(8)], [$a, $chosen, now()->subDays(8)], [$old, null, now()->subDays(39)]] as [$rfq, $quote, $at]) {
        $event = new ContactEvent;
        $event->forceFill(['rfq_id' => $rfq->id, 'quote_id' => $quote?->id ?? $old->quotes()->value('id'), 'user_id' => $this->buyer->id, 'channel' => 'whatsapp', 'created_at' => $at])->save();
    }

    // Work waiting: 2 pending suppliers, 1 pending specialty (on an approved supplier).
    supplierUser(CompanyStatus::Pending);
    supplierUser(CompanyStatus::Pending);
    supplierUser(CompanyStatus::Approved, [Category::factory()->create()->id => 'pending']);
});

it('computes the documented definitions for the last 30 days', function () {
    $data = asAdminUser($this->admin)->getJson('/api/admin/metrics')->assertOk()->json('data');

    expect($data['period_days'])->toBe(30)
        ->and($data['rfqs']['created'])->toBe(6)
        ->and($data['rfqs']['by_status'])->toMatchArray(['open' => 3, 'closed' => 1, 'pending_review' => 1, 'rejected' => 1, 'cancelled' => 0, 'expired' => 0])
        // Reached suppliers = has a category: 1, 2, 3, 5 (not the pending or the rejected one).
        ->and($data['rfqs']['published'])->toBe(4)
        ->and($data['rfqs']['with_quote'])->toBe(2)
        ->and($data['rfqs']['with_quote_rate'])->toBe(0.5)
        ->and($data['rfqs']['with_selection'])->toBe(1)
        // Median of 120 and 30 minutes.
        ->and($data['first_quote'])->toEqual(['sample' => 2, 'median_minutes' => 75])
        ->and($data['triage'])->toEqual(['sample' => 2, 'median_minutes' => 60])
        ->and($data['contacts'])->toBe(['reveals' => 2, 'rfqs' => 1])
        ->and($data['queue'])->toBe(['suppliers_pending' => 2, 'specialties_pending' => 1, 'rfqs_pending_review' => 1]);
});

it('widens the period on request and validates it', function () {
    $all = asAdminUser($this->admin)->getJson('/api/admin/metrics?period=all')->assertOk()->json('data');
    expect($all['period_days'])->toBeNull()
        ->and($all['rfqs']['created'])->toBe(7)
        ->and($all['first_quote'])->toEqual(['sample' => 3, 'median_minutes' => 120])
        ->and($all['contacts'])->toBe(['reveals' => 3, 'rfqs' => 2]);

    $week = asAdminUser($this->admin)->getJson('/api/admin/metrics?period=7')->assertOk()->json('data');
    expect($week['rfqs']['created'])->toBe(5)
        ->and($week['first_quote'])->toEqual(['sample' => 1, 'median_minutes' => 30]);

    asAdminUser($this->admin)->getJson('/api/admin/metrics?period=5')->assertUnprocessable();
});

it('returns nulls, not zeros, when there is nothing to measure', function () {
    $this->travelTo(now()->addYears(2));

    $data = asAdminUser($this->admin)->getJson('/api/admin/metrics?period=7')->assertOk()->json('data');
    expect($data['rfqs']['created'])->toBe(0)
        ->and($data['rfqs']['with_quote_rate'])->toBeNull()
        ->and($data['first_quote'])->toEqual(['sample' => 0, 'median_minutes' => null]);
});
