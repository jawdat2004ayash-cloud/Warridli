<?php

use App\Actions\Rfqs\ExpireRfqs;
use App\Enums\CompanyStatus;
use App\Enums\QuoteStatus;
use App\Enums\RfqStatus;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Company;
use App\Models\ContactEvent;
use App\Models\Quote;
use App\Models\Rfq;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

/**
 * A stored quote from $supplier on $rfq (bypasses the supplier API; that flow is covered in QuoteTest).
 */
function quoteFrom(User $supplier, Rfq $rfq, array $attrs = []): Quote
{
    $quote = new Quote;
    $quote->forceFill(array_merge([
        'rfq_id' => $rfq->id,
        'supplier_company_id' => $supplier->company()->id,
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

function selectQuote(Rfq $rfq, Quote $quote, ?string $seen = null): TestResponse
{
    return spa()->postJson("/api/rfqs/{$rfq->ulid}/quotes/{$quote->id}/select", ['seen_updated_at' => $seen ?? $quote->updated_at->toISOString()]);
}

beforeEach(function () {
    $this->category = Category::factory()->create();
    $this->buyer = User::factory()->create();
    Company::factory()->ownedBy($this->buyer)->create();
    $this->rfq = Rfq::factory()->createdBy($this->buyer)->create(['category_id' => $this->category->id, 'quantity' => 4, 'description' => 'بيليا مضخة']);

    $approved = [$this->category->id => 'approved'];
    $this->supplierA = supplierUser(CompanyStatus::Approved, $approved);
    $this->supplierA->company()->forceFill(['name' => 'محل النور', 'whatsapp_phone' => '+963944111222'])->save();
    $this->supplierB = supplierUser(CompanyStatus::Approved, $approved);
    $this->supplierB->company()->forceFill(['name' => 'مستودع الأمين', 'whatsapp_phone' => '+963933444555'])->save();

    $this->cheap = quoteFrom($this->supplierA, $this->rfq, ['unit_price' => '90000.00', 'brand' => 'SKF']);
    $this->pricey = quoteFrom($this->supplierB, $this->rfq, ['unit_price' => '120000.00', 'stock_status' => 'on_order', 'lead_time_days' => 3]);
    $this->usd = quoteFrom(supplierUser(CompanyStatus::Approved, $approved), $this->rfq, ['unit_price' => '7.50', 'currency' => 'USD']);
    $this->withdrawn = quoteFrom(supplierUser(CompanyStatus::Approved, $approved), $this->rfq, ['unit_price' => '1.00', 'status' => QuoteStatus::Withdrawn]);
    $suspended = supplierUser(CompanyStatus::Approved, $approved);
    $this->hidden = quoteFrom($suspended, $this->rfq, ['unit_price' => '2.00']);
    $suspended->company()->forceFill(['status' => CompanyStatus::Suspended])->save();
});

it('shows the owner the comparable quotes, cheapest first per currency, without supplier phones', function () {
    $this->actingAs($this->buyer);

    $response = spa()->getJson("/api/rfqs/{$this->rfq->ulid}/quotes")->assertOk();

    expect($response->json('data.*.id'))->toBe([$this->cheap->id, $this->pricey->id, $this->usd->id])
        ->and(array_keys($response->json('data.0')))->toBe(['id', 'supplier', 'unit_price', 'currency', 'condition', 'brand', 'origin', 'stock_status', 'lead_time_days', 'fulfillment', 'valid_until', 'price_expired', 'notes', 'updated_at', 'selected'])
        ->and($response->json('data.0.supplier.name'))->toBe('محل النور')
        ->and($response->json('data.1.lead_time_days'))->toBe(3)
        ->and($response->getContent())->not->toContain('944111222')->not->toContain('933444555')->not->toContain('supplier_company_id');

    spa()->getJson("/api/rfqs/{$this->rfq->ulid}")->assertJsonPath('data.quotes_count', 3);
});

it('hides the quotes and every quote action of an RFQ from anyone but its buyer company', function (string $who) {
    $user = match ($who) {
        'other buyer' => tap(User::factory()->create(), fn ($u) => Company::factory()->ownedBy($u)->create()),
        'quoting supplier' => $this->supplierA,
        'admin' => User::factory()->admin()->create(),
    };
    $this->actingAs($user);

    spa()->getJson("/api/rfqs/{$this->rfq->ulid}/quotes")->assertNotFound();
    selectQuote($this->rfq, $this->cheap)->assertNotFound();
    spa()->postJson("/api/rfqs/{$this->rfq->ulid}/quotes/{$this->cheap->id}/contact")->assertNotFound();
    spa()->postJson("/api/rfqs/{$this->rfq->ulid}/close")->assertNotFound();

    expect($this->rfq->refresh()->status)->toBe(RfqStatus::Open)
        ->and(ContactEvent::query()->count())->toBe(0);
})->with(['other buyer', 'quoting supplier', 'admin']);

it('requires login for quotes', function () {
    $this->getJson("/api/rfqs/{$this->rfq->ulid}/quotes")->assertUnauthorized();
    $this->postJson("/api/rfqs/{$this->rfq->ulid}/quotes/{$this->cheap->id}/select")->assertUnauthorized();
});

it('does not accept a quote of another RFQ through this RFQ\'s URL', function () {
    $mine = Rfq::factory()->createdBy($this->buyer)->create(['category_id' => $this->category->id]);
    $this->actingAs($this->buyer);

    selectQuote($mine, $this->cheap)->assertNotFound();
    spa()->postJson("/api/rfqs/{$mine->ulid}/quotes/{$this->cheap->id}/contact")->assertNotFound();
    expect($mine->refresh()->selected_quote_id)->toBeNull();
});

it('closes the RFQ on the chosen quote, audits it, and tells only the chosen supplier', function () {
    $this->actingAs($this->buyer);

    selectQuote($this->rfq, $this->cheap)->assertOk()
        ->assertJsonPath('data.status', 'closed')
        ->assertJsonPath('data.selected_quote_id', $this->cheap->id)
        ->assertJsonPath('data.accepts_quotes', false);

    expect(spa()->getJson("/api/rfqs/{$this->rfq->ulid}/quotes")->json('data.*.selected'))->toBe([true, false, false]);
    $log = AuditLog::query()->where('action', 'rfq.quote_selected')->sole();
    expect([$log->actor_user_id, $log->subject_type, $log->subject_id])->toBe([$this->buyer->id, 'rfq', $this->rfq->id])
        ->and($log->meta)->toBe(['from' => 'open', 'quote_id' => $this->cheap->id, 'supplier_company_id' => $this->supplierA->company()->id, 'unit_price' => '90000.00', 'currency' => 'SYP']);

    actAs($this->supplierA);
    spa()->getJson("/api/supplier/rfqs/{$this->rfq->ulid}")->assertJsonPath('data.my_quote.selected', true)->assertJsonPath('data.status', 'closed');
    actAs($this->supplierB);
    $b = spa()->getJson("/api/supplier/rfqs/{$this->rfq->ulid}")->assertJsonPath('data.my_quote.selected', false);
    expect($b->getContent())->not->toContain('90000')->not->toContain('محل النور');
    spa()->putJson("/api/supplier/rfqs/{$this->rfq->ulid}/quote", quotePayload())->assertStatus(409);
});

it('treats choosing the same quote twice as one choice, and refuses a different one afterwards', function () {
    $this->actingAs($this->buyer);

    selectQuote($this->rfq, $this->cheap)->assertOk();
    selectQuote($this->rfq, $this->cheap)->assertOk()->assertJsonPath('data.selected_quote_id', $this->cheap->id);
    selectQuote($this->rfq, $this->pricey)->assertStatus(409)
        ->assertJsonPath('message', 'لا يمكن اختيار عرض لطلب حالته «مُغلق». حدّث الصفحة لترى الحالة الحالية.');

    expect(AuditLog::query()->where('action', 'rfq.quote_selected')->count())->toBe(1)
        ->and($this->rfq->refresh()->selected_quote_id)->toBe($this->cheap->id);
});

it('refuses quotes that were withdrawn, whose supplier was suspended, or whose price expired', function () {
    $this->actingAs($this->buyer);
    $expired = quoteFrom(supplierUser(CompanyStatus::Approved, [$this->category->id => 'approved']), $this->rfq, ['valid_until' => now('Asia/Damascus')->subDay()->toDateString()]);

    selectQuote($this->rfq, $this->withdrawn)->assertStatus(409)
        ->assertJsonPath('message', 'لم يعد هذا العرض متاحاً (سحبه المورّد أو لم يعد المورّد مفعّلاً). حدّث الصفحة لترى العروض الحالية.');
    selectQuote($this->rfq, $this->hidden)->assertStatus(409);
    selectQuote($this->rfq, $expired)->assertStatus(409)
        ->assertJsonPath('message', 'انتهت صلاحية سعر هذا العرض. تواصل مع المورّد لتجديده، أو اختر عرضاً آخر.');

    expect($this->rfq->refresh()->status)->toBe(RfqStatus::Open);
});

it('refuses a quote the supplier changed after the buyer saw it, then accepts the new version', function () {
    $seen = $this->pricey->updated_at->toISOString();
    $this->travel(5)->seconds();
    actAs($this->supplierB);
    spa()->putJson("/api/supplier/rfqs/{$this->rfq->ulid}/quote", quotePayload(['unit_price' => '150000']))->assertOk();

    actAs($this->buyer);
    selectQuote($this->rfq, $this->pricey, $seen)->assertStatus(409)
        ->assertJsonPath('message', 'عدّل المورّد هذا العرض بعد أن فتحت الصفحة. راجع السعر الجديد ثم اختر من جديد.');

    $fresh = collect(spa()->getJson("/api/rfqs/{$this->rfq->ulid}/quotes")->json('data'))->firstWhere('id', $this->pricey->id);
    expect($fresh['unit_price'])->toBe('150000.00');
    selectQuote($this->rfq, $this->pricey, $fresh['updated_at'])->assertOk();
});

it('requires the seen version when choosing', function () {
    $this->actingAs($this->buyer);

    spa()->postJson("/api/rfqs/{$this->rfq->ulid}/quotes/{$this->cheap->id}/select", [])->assertUnprocessable()
        ->assertJsonPath('errors.seen_updated_at.0', 'حدّث الصفحة ثم اختر العرض من جديد.');
});

it('preserves second-precision legacy quote versions while returning fractional ISO timestamps', function () {
    $legacy = now()->startOfSecond();
    $this->pricey->forceFill(['created_at' => $legacy, 'updated_at' => $legacy])->save();
    actAs($this->buyer);
    $fresh = collect(spa()->getJson("/api/rfqs/{$this->rfq->ulid}/quotes")->assertOk()->json('data'))->firstWhere('id', $this->pricey->id);
    expect($fresh['updated_at'])->toBe($legacy->toISOString())
        ->and($this->pricey->refresh()->created_at->equalTo($legacy))->toBeTrue();
    selectQuote($this->rfq, $this->pricey, $legacy->toIso8601String())->assertOk();
});

it('refuses an unseen quote change within the same second, including a frozen or backward clock', function (int $microseconds) {
    $this->travelTo(now()->startOfSecond()->addMicroseconds(100000));
    $this->pricey->forceFill(['updated_at' => now()])->save();
    $seen = $this->pricey->refresh()->updated_at->toISOString();
    $this->travelTo(now()->addMicroseconds($microseconds));

    actAs($this->supplierB);
    $response = spa()->putJson("/api/supplier/rfqs/{$this->rfq->ulid}/quote", quotePayload(['unit_price' => '150000']))->assertOk();
    expect($response->json('data.my_quote.updated_at'))->toBe($this->pricey->fresh()->updated_at->toISOString());
    actAs($this->buyer);
    selectQuote($this->rfq, $this->pricey, $seen)->assertConflict();
    expect($this->rfq->refresh()->status)->toBe(RfqStatus::Open)
        ->and(AuditLog::query()->where('action', 'rfq.quote_selected')->count())->toBe(0);

    $fresh = collect(spa()->getJson("/api/rfqs/{$this->rfq->ulid}/quotes")->assertOk()->json('data'))->firstWhere('id', $this->pricey->id);
    expect($fresh['updated_at'])->not->toBe($seen)
        ->and($fresh['unit_price'])->toBe('150000.00');
    selectQuote($this->rfq, $this->pricey, $fresh['updated_at'])->assertOk();
})->with(['100 milliseconds later' => 100000, 'same clock instant' => 0, 'clock moves backward' => -100000]);

it('rolls back an expiry transition when its audit write fails, so a retry can record it', function () {
    $this->rfq->forceFill(['closes_at' => now()->subMinute()])->save();
    $logger = Mockery::mock(AuditLogger::class);
    $logger->shouldReceive('record')->once()->andThrow(new RuntimeException('synthetic audit failure'));
    $action = new ExpireRfqs($logger);

    expect(fn () => $action->handle())->toThrow(RuntimeException::class, 'synthetic audit failure');
    expect($this->rfq->refresh()->status)->toBe(RfqStatus::Open)
        ->and(AuditLog::query()->where('action', 'rfq.expired')->count())->toBe(0);
    expect(app(ExpireRfqs::class)->handle())->toBe(1)
        ->and(AuditLog::query()->where('action', 'rfq.expired')->count())->toBe(1);
});

it('lets the buyer choose after the answer window passed (expired), but not on a cancelled RFQ', function () {
    $this->actingAs($this->buyer);
    $this->rfq->forceFill(['status' => RfqStatus::Expired])->save();
    selectQuote($this->rfq, $this->cheap)->assertOk()->assertJsonPath('data.status', 'closed');

    $cancelled = Rfq::factory()->createdBy($this->buyer)->create(['category_id' => $this->category->id, 'status' => RfqStatus::Cancelled]);
    selectQuote($cancelled, quoteFrom($this->supplierA, $cancelled))->assertStatus(409);
});

it('closes without choosing, once, audited', function () {
    $this->actingAs($this->buyer);

    spa()->postJson("/api/rfqs/{$this->rfq->ulid}/close")->assertOk()->assertJsonPath('data.status', 'closed')->assertJsonPath('data.selected_quote_id', null);
    spa()->postJson("/api/rfqs/{$this->rfq->ulid}/close")->assertStatus(409);
    spa()->postJson("/api/rfqs/{$this->rfq->ulid}/cancel")->assertStatus(409);

    expect(AuditLog::query()->where('action', 'rfq.closed')->sole()->meta)->toBe(['from' => 'open']);
});

it('reveals a supplier\'s WhatsApp only on request, logged, with a prefilled wa.me link', function () {
    $this->actingAs($this->buyer);

    $response = spa()->postJson("/api/rfqs/{$this->rfq->ulid}/quotes/{$this->cheap->id}/contact")->assertOk();

    expect($response->json('data.phone'))->toBe('+963944111222')
        ->and($response->json('data.whatsapp_url'))->toStartWith('https://wa.me/963944111222?text=')
        ->and(rawurldecode(explode('text=', $response->json('data.whatsapp_url'))[1]))->toContain('بيليا مضخة');
    $event = ContactEvent::query()->sole();
    expect([$event->rfq_id, $event->quote_id, $event->user_id, $event->channel])->toBe([$this->rfq->id, $this->cheap->id, $this->buyer->id, 'whatsapp']);
});

it('only reveals contacts the buyer can still act on', function () {
    $this->actingAs($this->buyer);
    $url = fn (Quote $q) => "/api/rfqs/{$this->rfq->ulid}/quotes/{$q->id}/contact";

    spa()->postJson($url($this->withdrawn))->assertStatus(409);
    spa()->postJson($url($this->hidden))->assertStatus(409);

    selectQuote($this->rfq, $this->cheap)->assertOk();
    spa()->postJson($url($this->cheap))->assertOk();
    spa()->postJson($url($this->pricey))->assertStatus(409)
        ->assertJsonPath('message', 'أغلقت هذا الطلب على عرض آخر، لذلك لا نُظهر رقم هذا المورّد.');

    expect(ContactEvent::query()->count())->toBe(1);
});

it('rate-limits contact reveals', function () {
    $this->actingAs($this->buyer);

    foreach (range(1, 20) as $i) {
        spa()->postJson("/api/rfqs/{$this->rfq->ulid}/quotes/{$this->cheap->id}/contact")->assertOk();
    }
    spa()->postJson("/api/rfqs/{$this->rfq->ulid}/quotes/{$this->cheap->id}/contact")->assertStatus(429);
});

it('expires open RFQs past their deadline — idempotent, audited, leaving other states alone', function () {
    $past = now()->subMinute();
    $this->rfq->forceFill(['closes_at' => $past])->save();
    $pending = Rfq::factory()->createdBy($this->buyer)->create(['category_id' => null, 'status' => RfqStatus::PendingReview, 'closes_at' => $past]);
    $closed = Rfq::factory()->createdBy($this->buyer)->create(['status' => RfqStatus::Closed, 'closes_at' => $past]);
    $future = Rfq::factory()->createdBy($this->buyer)->create();

    $this->artisan('warridli:expire-rfqs')->expectsOutput('Expired RFQs: 1')->assertSuccessful();
    $this->artisan('warridli:expire-rfqs')->expectsOutput('Expired RFQs: 0')->assertSuccessful();

    expect($this->rfq->refresh()->status)->toBe(RfqStatus::Expired)
        ->and($pending->refresh()->status)->toBe(RfqStatus::PendingReview)
        ->and($closed->refresh()->status)->toBe(RfqStatus::Closed)
        ->and($future->refresh()->status)->toBe(RfqStatus::Open);
    $log = AuditLog::query()->where('action', 'rfq.expired')->sole();
    expect([$log->actor_user_id, $log->subject_id])->toBe([null, $this->rfq->id]);

    // The buyer can still choose among the received quotes.
    $this->actingAs($this->buyer);
    selectQuote($this->rfq, $this->cheap)->assertOk();
});

it('schedules the expiry command', function () {
    Artisan::call('schedule:list');

    expect(Artisan::output())->toContain('warridli:expire-rfqs');
});
