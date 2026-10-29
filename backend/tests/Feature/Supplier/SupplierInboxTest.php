<?php

use App\Enums\CompanyStatus;
use App\Enums\RfqStatus;
use App\Models\Category;
use App\Models\Company;
use App\Models\Rfq;
use App\Models\RfqAttachment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('local');
    $this->bearings = Category::factory()->create(['name_ar' => 'بيليا']);
    $this->belts = Category::factory()->create(['name_ar' => 'سيور']);

    $this->buyer = User::factory()->create(['name' => 'أبو خالد', 'email' => 'buyer-secret@example.com']);
    Company::factory()->ownedBy($this->buyer)->create(['name' => 'ورشة السرية', 'whatsapp_phone' => '+963944000111']);
    $rfq = fn (array $attrs) => Rfq::factory()->createdBy($this->buyer)->create($attrs);

    $this->bearingRfq = $rfq(['category_id' => $this->bearings->id, 'description' => 'بيليا مضخة']);
    $this->beltRfq = $rfq(['category_id' => $this->belts->id, 'description' => 'سير مروحة']);
    $this->pendingReview = $rfq(['category_id' => null, 'status' => RfqStatus::PendingReview, 'description' => 'قطعة مجهولة']);
    $this->expired = $rfq(['category_id' => $this->bearings->id, 'closes_at' => now()->subMinute(), 'description' => 'منتهي']);
    $this->cancelled = $rfq(['category_id' => $this->bearings->id, 'status' => RfqStatus::Cancelled, 'description' => 'ملغى']);

    Storage::disk('local')->put('rfq-photos/a/1.jpg', 'jpeg');
    $this->photo = new RfqAttachment;
    $this->photo->forceFill(['rfq_id' => $this->bearingRfq->id, 'path' => 'rfq-photos/a/1.jpg', 'mime' => 'image/jpeg', 'size' => 4, 'width' => 1, 'height' => 1])->save();

    // Approved for bearings only; belts requested but not yet verified.
    $this->supplier = supplierUser(CompanyStatus::Approved, [$this->bearings->id => 'approved', $this->belts->id => 'pending']);
});

it('shows only open, unexpired RFQs in approved categories — never pending-review, other categories, expired or cancelled', function () {
    $this->actingAs($this->supplier);

    $response = spa()->getJson('/api/supplier/rfqs')->assertOk();

    expect($response->json('data.*.id'))->toBe([$this->bearingRfq->ulid])
        ->and($response->json('data.0.accepts_quotes'))->toBeTrue()
        ->and($response->json('data.0.my_quote'))->toBeNull()
        ->and($response->json('data.0.photos_count'))->toBe(1);
});

it('never exposes the buyer identity or contact details (D4)', function () {
    $this->actingAs($this->supplier);

    $list = spa()->getJson('/api/supplier/rfqs')->getContent();
    $detail = spa()->getJson("/api/supplier/rfqs/{$this->bearingRfq->ulid}")->assertOk();

    foreach ([$list, $detail->getContent()] as $json) {
        expect($json)->not->toContain('ورشة السرية')->not->toContain('أبو خالد')->not->toContain('buyer-secret')
            ->not->toContain('944000111')->not->toContain('buyer_company')->not->toContain('created_by');
    }
    expect(array_keys($detail->json('data')))->toBe(['id', 'status', 'accepts_quotes', 'category', 'description', 'part_number', 'machine_make', 'machine_model', 'quantity', 'unit', 'urgency', 'area', 'closes_at', 'created_at', 'photos_count', 'photos', 'my_quote']);
});

it('answers 404 for RFQs outside the supplier\'s targeting, whatever the reason', function (string $which) {
    $this->actingAs($this->supplier);
    $ulid = $which === 'unknown' ? '01jbzzzzzzzzzzzzzzzzzzzzzz' : $this->{$which}->ulid;

    spa()->getJson("/api/supplier/rfqs/{$ulid}")->assertNotFound()->assertJsonPath('message', 'الصفحة أو العنصر المطلوب غير موجود.');
    spa()->getJson("/api/supplier/rfqs/{$ulid}/photos/{$this->photo->id}")->assertNotFound();
    spa()->putJson("/api/supplier/rfqs/{$ulid}/quote", quotePayload())->assertNotFound();
})->with(['beltRfq', 'pendingReview', 'expired', 'cancelled', 'unknown']);

it('serves the photo of a visible RFQ only through the supplier route', function () {
    $this->actingAs($this->supplier);

    $url = spa()->getJson("/api/supplier/rfqs/{$this->bearingRfq->ulid}")->json('data.photos.0.url');
    expect($url)->toBe("/api/supplier/rfqs/{$this->bearingRfq->ulid}/photos/{$this->photo->id}");
    expect(spa()->get($url)->assertOk()->headers->get('X-Content-Type-Options'))->toBe('nosniff');

    // The buyer-side URL stays closed to suppliers.
    spa()->getJson("/api/rfqs/{$this->bearingRfq->ulid}/photos/{$this->photo->id}")->assertNotFound();
    spa()->getJson("/api/rfqs/{$this->bearingRfq->ulid}")->assertNotFound();
});

it('starts showing a category\'s RFQs only once the specialty is approved', function () {
    $this->actingAs($this->supplier);
    expect(spa()->getJson('/api/supplier/rfqs')->json('data.*.id'))->not->toContain($this->beltRfq->ulid);

    $admin = User::factory()->admin()->create();
    actAs($admin);
    spa()->postJson("/api/admin/supplier-categories/{$this->supplier->company()->id}/{$this->belts->id}/approve")->assertOk();

    actAs($this->supplier);
    expect(spa()->getJson('/api/supplier/rfqs')->json('data.*.id'))->toContain($this->beltRfq->ulid);
});

it('keeps non-approved suppliers, buyers and admins out with a clear 403 — even for unknown ids (no probing)', function (string $who, string $message) {
    $user = match ($who) {
        'pending supplier' => supplierUser(CompanyStatus::Pending, [$this->bearings->id => 'approved']),
        'rejected supplier' => supplierUser(CompanyStatus::Rejected, [$this->bearings->id => 'approved']),
        'buyer' => $this->buyer,
        'admin' => User::factory()->admin()->create(),
    };
    $this->actingAs($user);

    spa()->getJson('/api/supplier/rfqs')->assertForbidden()->assertJsonPath('message', $message);
    spa()->getJson("/api/supplier/rfqs/{$this->bearingRfq->ulid}")->assertForbidden();
    spa()->getJson('/api/supplier/rfqs/01jbzzzzzzzzzzzzzzzzzzzzzz')->assertForbidden();
    spa()->getJson("/api/supplier/rfqs/{$this->bearingRfq->ulid}/photos/{$this->photo->id}")->assertForbidden();
    spa()->putJson("/api/supplier/rfqs/{$this->bearingRfq->ulid}/quote", quotePayload())->assertForbidden();
})->with([
    ['pending supplier', 'حساب المورّد قيد المراجعة. ستتمكن من استخدام هذه الميزة بعد موافقة إدارة ورّدلي.'],
    ['rejected supplier', 'لم تتم الموافقة على حساب المورّد. تواصل مع إدارة ورّدلي لمعرفة التفاصيل.'],
    ['buyer', 'هذه الميزة متاحة للمورّدين المعتمدين فقط.'],
    ['admin', 'هذه الميزة متاحة للمورّدين المعتمدين فقط.'],
]);

it('logs out a supplier whose company gets suspended', function () {
    $this->supplier->company()->forceFill(['status' => CompanyStatus::Suspended])->save();
    actAs($this->supplier);

    spa()->getJson('/api/supplier/rfqs')->assertForbidden()->assertJsonPath('message', 'حساب شركتك موقوف حالياً. تواصل مع إدارة ورّدلي لمعرفة السبب.');
    $this->assertGuest('web');
});

it('requires login', function () {
    $this->getJson('/api/supplier/rfqs')->assertUnauthorized();
    $this->getJson("/api/supplier/rfqs/{$this->bearingRfq->ulid}")->assertUnauthorized();
});

it('rejects unknown inbox tabs', function () {
    $this->actingAs($this->supplier);

    spa()->getJson('/api/supplier/rfqs?tab=all')->assertUnprocessable()->assertJsonPath('errors.tab.0', 'القيمة المختارة في حقل القائمة غير صحيحة.');
});
