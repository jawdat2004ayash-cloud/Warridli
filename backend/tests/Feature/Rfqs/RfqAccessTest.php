<?php

use App\Enums\CompanyStatus;
use App\Enums\RfqStatus;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\CompanyMember;
use App\Models\Rfq;
use App\Models\RfqAttachment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('local');
    $this->buyer = User::factory()->create();
    Company::factory()->ownedBy($this->buyer)->create();
    $this->intruder = User::factory()->create();
    Company::factory()->ownedBy($this->intruder)->create();

    $this->rfq = Rfq::factory()->createdBy($this->buyer)->create(['description' => 'سير مروحة لمكبس هيدروليك']);
    Storage::disk('local')->put('rfq-photos/x/photo.jpg', 'jpeg-bytes');
    $this->photo = new RfqAttachment;
    $this->photo->forceFill(['rfq_id' => $this->rfq->id, 'path' => 'rfq-photos/x/photo.jpg', 'mime' => 'image/jpeg', 'size' => 10, 'width' => 1, 'height' => 1])->save();
});

it('lists only the buyer company\'s own RFQs, newest first, paginated, without N+1', function () {
    Rfq::factory()->createdBy($this->intruder)->create(['description' => 'طلب شركة أخرى']);
    $newer = Rfq::factory()->createdBy($this->buyer)->create(['created_at' => now()->addMinute()]);
    $this->actingAs($this->buyer);

    $response = spa()->getJson('/api/rfqs')->assertOk();

    expect($response->json('data.*.id'))->toBe([$newer->ulid, $this->rfq->ulid])
        ->and($response->json('data.1.photos_count'))->toBe(1)
        ->and($response->json('data.0'))->not->toHaveKey('photos')
        ->and($response->json('meta.per_page'))->toBe(20)
        ->and($response->getContent())->not->toContain('طلب شركة أخرى');
});

it('shares RFQs between members of the same company', function () {
    $colleague = User::factory()->create();
    $membership = new CompanyMember;
    $membership->forceFill(['company_id' => $this->rfq->buyer_company_id, 'user_id' => $colleague->id, 'role' => 'member'])->save();
    $this->actingAs($colleague);

    spa()->getJson("/api/rfqs/{$this->rfq->ulid}")->assertOk();
});

it('shows the owner the RFQ with photo URLs, and serves the photo with safe headers', function () {
    $this->actingAs($this->buyer);

    $url = spa()->getJson("/api/rfqs/{$this->rfq->ulid}")
        ->assertOk()
        ->assertJsonPath('data.description', 'سير مروحة لمكبس هيدروليك')
        ->json('data.photos.0.url');

    expect($url)->toBe("/api/rfqs/{$this->rfq->ulid}/photos/{$this->photo->id}");

    $photo = spa()->get($url)->assertOk();
    expect($photo->headers->get('Content-Type'))->toBe('image/jpeg')
        ->and($photo->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($photo->headers->get('Cache-Control'))->toContain('private')
        ->and($photo->streamedContent())->toBe('jpeg-bytes');
});

it('hides another company\'s RFQ, photos and cancel action behind a 404', function () {
    $this->actingAs($this->intruder);

    spa()->getJson("/api/rfqs/{$this->rfq->ulid}")->assertNotFound()
        ->assertJsonPath('message', 'الصفحة أو العنصر المطلوب غير موجود.');
    spa()->getJson("/api/rfqs/{$this->rfq->ulid}/photos/{$this->photo->id}")->assertNotFound();
    spa()->postJson("/api/rfqs/{$this->rfq->ulid}/cancel")->assertNotFound();

    expect($this->rfq->refresh()->status)->toBe(RfqStatus::Open)
        ->and(AuditLog::query()->where('action', 'rfq.cancelled')->count())->toBe(0);
});

it('answers the same 404 for unknown and malformed RFQ ids', function () {
    $this->actingAs($this->buyer);

    spa()->getJson('/api/rfqs/01jbzzzzzzzzzzzzzzzzzzzzzz')->assertNotFound();
    spa()->getJson('/api/rfqs/1')->assertNotFound();
    spa()->getJson("/api/rfqs/{$this->rfq->id}")->assertNotFound(); // numeric primary key is not an identifier
});

it('does not serve a photo through another RFQ the user owns (scoped binding)', function () {
    $mine = Rfq::factory()->createdBy($this->intruder)->create();
    $this->actingAs($this->intruder);

    spa()->get("/api/rfqs/{$mine->ulid}/photos/{$this->photo->id}")->assertNotFound();
});

it('keeps suppliers and admins out of the buyer RFQ list and details', function (string $who) {
    $user = User::factory()->create();
    $who === 'admin'
        ? $user->forceFill(['is_admin' => true])->save()
        : Company::factory()->supplier(CompanyStatus::Approved)->ownedBy($user)->create();
    $this->actingAs($user);

    spa()->getJson('/api/rfqs')->assertForbidden();
    spa()->getJson("/api/rfqs/{$this->rfq->ulid}")->assertNotFound();
    spa()->getJson("/api/rfqs/{$this->rfq->ulid}/photos/{$this->photo->id}")->assertNotFound();
})->with(['approved supplier', 'admin']);

it('requires login for RFQs and photos', function () {
    $this->getJson('/api/rfqs')->assertUnauthorized();
    $this->getJson("/api/rfqs/{$this->rfq->ulid}")->assertUnauthorized();
    $this->getJson("/api/rfqs/{$this->rfq->ulid}/photos/{$this->photo->id}")->assertUnauthorized();
});

it('lets the owner cancel an open or pending RFQ once, audited', function () {
    $this->actingAs($this->buyer);

    spa()->postJson("/api/rfqs/{$this->rfq->ulid}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
    spa()->postJson("/api/rfqs/{$this->rfq->ulid}/cancel")->assertStatus(409)
        ->assertJsonPath('message', 'لا يمكن إلغاء طلب حالته «مُلغى». حدّث الصفحة لترى الحالة الحالية.');

    expect(AuditLog::query()->where('action', 'rfq.cancelled')->sole()->meta)->toBe(['from' => 'open']);
});
