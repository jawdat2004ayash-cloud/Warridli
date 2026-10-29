<?php

use App\Enums\CompanyRole;
use App\Enums\CompanyStatus;
use App\Enums\QuoteStatus;
use App\Enums\RfqStatus;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Company;
use App\Models\CompanyMember;
use App\Models\Quote;
use App\Models\Rfq;
use App\Models\SupplierCategory;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->category = Category::factory()->create();
    $this->buyer = User::factory()->create();
    Company::factory()->ownedBy($this->buyer)->create();
    $this->rfq = Rfq::factory()->createdBy($this->buyer)->create(['category_id' => $this->category->id, 'quantity' => 4]);
    $this->supplier = supplierUser(CompanyStatus::Approved, [$this->category->id => 'approved']);
    $this->company = $this->supplier->company();
});

function putQuote(Rfq $rfq, array $body): TestResponse
{
    return spa()->putJson("/api/supplier/rfqs/{$rfq->ulid}/quote", $body);
}

it('submits a quote, returns it as my_quote and audits it', function () {
    $this->actingAs($this->supplier);

    putQuote($this->rfq, quotePayload())
        ->assertOk()
        ->assertJsonPath('data.my_quote.status', 'submitted')
        ->assertJsonPath('data.my_quote.unit_price', '125000.50')
        ->assertJsonPath('data.my_quote.lead_time_days', 0);

    $quote = Quote::query()->sole();
    expect([$quote->rfq_id, $quote->supplier_company_id, $quote->submitted_by])->toBe([$this->rfq->id, $this->company->id, $this->supplier->id]);

    $log = AuditLog::query()->where('action', 'quote.submitted')->sole();
    expect([$log->actor_user_id, $log->subject_type, $log->subject_id])->toBe([$this->supplier->id, 'quote', $quote->id])
        ->and($log->meta)->toBe(['rfq_id' => $this->rfq->id, 'unit_price' => '125000.50', 'currency' => 'SYP', 'changed' => null]);
});

it('edits the same quote instead of creating a duplicate, and records what changed', function () {
    $this->actingAs($this->supplier);
    putQuote($this->rfq, quotePayload())->assertOk();

    putQuote($this->rfq, quotePayload(['unit_price' => '119000', 'stock_status' => 'on_order', 'lead_time_days' => 3]))
        ->assertOk()
        ->assertJsonPath('data.my_quote.unit_price', '119000.00')
        ->assertJsonPath('data.my_quote.lead_time_days', 3);

    expect(Quote::query()->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'quote.updated')->sole()->meta['changed'])->toBe('unit_price,stock_status,lead_time_days');
});

it('lets a colleague in the same supplier company edit the company\'s single quote', function () {
    $this->actingAs($this->supplier);
    putQuote($this->rfq, quotePayload())->assertOk();

    $colleague = User::factory()->create();
    $member = new CompanyMember;
    $member->forceFill(['company_id' => $this->company->id, 'user_id' => $colleague->id, 'role' => CompanyRole::Member])->save();
    actAs($colleague);

    putQuote($this->rfq, quotePayload(['unit_price' => '120000']))->assertOk();
    expect(Quote::query()->count())->toBe(1)->and(Quote::query()->sole()->submitted_by)->toBe($colleague->id);
});

it('is protected against duplicates by the database too', function () {
    $this->actingAs($this->supplier);
    putQuote($this->rfq, quotePayload())->assertOk();

    $copy = Quote::query()->sole()->replicate();
    expect(fn () => $copy->save())->toThrow(UniqueConstraintViolationException::class);
});

it('withdraws, refuses a second withdraw, re-submits, and keeps the buyer count to submitted quotes', function () {
    $this->actingAs($this->supplier);
    putQuote($this->rfq, quotePayload())->assertOk();

    spa()->postJson("/api/supplier/rfqs/{$this->rfq->ulid}/quote/withdraw")->assertOk()->assertJsonPath('data.my_quote.status', 'withdrawn');
    spa()->postJson("/api/supplier/rfqs/{$this->rfq->ulid}/quote/withdraw")->assertStatus(409)
        ->assertJsonPath('message', 'لا يوجد عرض فعّال لك على هذا الطلب لسحبه.');

    actAs($this->buyer);
    spa()->getJson("/api/rfqs/{$this->rfq->ulid}")->assertJsonPath('data.quotes_count', 0);

    actAs($this->supplier);
    putQuote($this->rfq, quotePayload())->assertOk()->assertJsonPath('data.my_quote.status', 'submitted');

    actAs($this->buyer);
    spa()->getJson("/api/rfqs/{$this->rfq->ulid}")->assertJsonPath('data.quotes_count', 1);

    expect(AuditLog::query()->whereIn('action', ['quote.submitted', 'quote.withdrawn', 'quote.resubmitted'])->orderBy('id')->pluck('action')->all())
        ->toBe(['quote.submitted', 'quote.withdrawn', 'quote.resubmitted']);
});

it('validates prices, dates and required fields with Arabic messages', function (array $override, string $field, string $message) {
    $this->actingAs($this->supplier);

    putQuote($this->rfq, quotePayload($override))->assertUnprocessable()->assertJsonPath("errors.{$field}.0", $message);
    expect(Quote::query()->count())->toBe(0);
})->with([
    'zero price' => [['unit_price' => '0'], 'unit_price', 'السعر يجب أن يكون أكبر من صفر.'],
    'negative price' => [['unit_price' => '-5'], 'unit_price', 'السعر يجب أن يكون أكبر من صفر.'],
    'text price' => [['unit_price' => 'مية ألف'], 'unit_price', 'اكتب السعر أرقاماً فقط، مثل 125000.'],
    'three decimals' => [['unit_price' => '10.555'], 'unit_price', 'السعر يقبل خانتين عشريتين على الأكثر.'],
    'too large' => [['unit_price' => '1000000000000'], 'unit_price', 'السعر كبير جداً. تحقّق من عدد الأصفار.'],
    'missing price' => [['unit_price' => null], 'unit_price', 'حقل سعر الوحدة مطلوب.'],
    'bad currency' => [['currency' => 'EUR'], 'currency', 'القيمة المختارة في حقل العملة غير صحيحة.'],
    'bad condition' => [['condition' => 'broken'], 'condition', 'القيمة المختارة في حقل حالة القطعة غير صحيحة.'],
    'on order without days' => [['stock_status' => 'on_order', 'lead_time_days' => null], 'lead_time_days', 'اكتب خلال كم يوم تتوفر القطعة.'],
    'lead time too long' => [['stock_status' => 'on_order', 'lead_time_days' => 400], 'lead_time_days', 'مدة التوفير يجب ألا يزيد عن 365.'],
    'valid until in the past' => [['valid_until' => '2020-01-01'], 'valid_until', 'تاريخ صلاحية العرض لا يمكن أن يكون في الماضي.'],
    'valid until too far' => [['valid_until' => now()->addDays(90)->toDateString()], 'valid_until', 'صلاحية العرض 60 يوماً كحد أقصى.'],
    'bad fulfillment' => [['fulfillment' => 'drone'], 'fulfillment', 'القيمة المختارة في حقل طريقة الاستلام غير صحيحة.'],
]);

it('ignores ownership and status fields smuggled into the body', function () {
    $other = Company::factory()->supplier(CompanyStatus::Approved)->ownedBy()->create();
    $this->actingAs($this->supplier);

    putQuote($this->rfq, quotePayload(['supplier_company_id' => $other->id, 'status' => 'withdrawn', 'rfq_id' => 999, 'submitted_by' => 1]))->assertOk();

    $quote = Quote::query()->sole();
    expect([$quote->supplier_company_id, $quote->status, $quote->rfq_id])->toBe([$this->company->id, QuoteStatus::Submitted, $this->rfq->id]);
});

it('never shows a competitor\'s quote', function () {
    $competitor = supplierUser(CompanyStatus::Approved, [$this->category->id => 'approved']);
    $this->actingAs($competitor);
    putQuote($this->rfq, quotePayload(['unit_price' => '777777']))->assertOk();

    actAs($this->supplier);
    $detail = spa()->getJson("/api/supplier/rfqs/{$this->rfq->ulid}")->assertOk();
    $list = spa()->getJson('/api/supplier/rfqs')->assertOk();

    expect($detail->json('data.my_quote'))->toBeNull()
        ->and($detail->getContent().$list->getContent())->not->toContain('777777');
});

it('refuses to quote on an RFQ that was cancelled after the supplier quoted, but still shows it under "quoted"', function () {
    $this->actingAs($this->supplier);
    putQuote($this->rfq, quotePayload())->assertOk();
    $this->rfq->forceFill(['status' => RfqStatus::Cancelled])->save();

    putQuote($this->rfq, quotePayload(['unit_price' => '1']))->assertStatus(409)
        ->assertJsonPath('message', 'هذا الطلب لم يعد يستقبل عروضاً (أُلغي أو أُغلق أو انتهت مدته).');
    spa()->postJson("/api/supplier/rfqs/{$this->rfq->ulid}/quote/withdraw")->assertStatus(409);

    expect(spa()->getJson('/api/supplier/rfqs?tab=quoted')->json('data.0'))
        ->toMatchArray(['id' => $this->rfq->ulid, 'status' => 'cancelled', 'accepts_quotes' => false])
        ->and(spa()->getJson('/api/supplier/rfqs')->json('data'))->toBe([]);
});

it('refuses edits once the supplier\'s approval for that category is removed', function () {
    $this->actingAs($this->supplier);
    putQuote($this->rfq, quotePayload())->assertOk();
    SupplierCategory::query()->where('company_id', $this->company->id)->delete();

    putQuote($this->rfq, quotePayload())->assertStatus(409)
        ->assertJsonPath('message', 'لم يعد تصنيف هذا الطلب ضمن تخصصاتك المعتمدة، لذلك لا يمكنك تقديم عرض عليه.');
});

it('answers 404, not 422, for an RFQ outside targeting even with an invalid body (no existence leak)', function () {
    $foreign = Rfq::factory()->createdBy($this->buyer)->create(['category_id' => Category::factory()->create()->id]);
    $this->actingAs($this->supplier);

    putQuote($foreign, ['unit_price' => 'x'])->assertNotFound();
});

it('rate-limits quote submissions', function () {
    $this->actingAs($this->supplier);

    foreach (range(1, 20) as $i) {
        putQuote($this->rfq, quotePayload(['unit_price' => (string) (1000 + $i)]))->assertOk();
    }
    putQuote($this->rfq, quotePayload())->assertStatus(429);
});
