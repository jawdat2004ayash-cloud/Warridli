<?php

use App\Actions\Admin\TriageRfq;
use App\Enums\CompanyStatus;
use App\Enums\RfqStatus;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Company;
use App\Models\Rfq;
use App\Models\RfqAttachment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->category = Category::factory()->create(['name_ar' => 'بيليا']);
    $this->buyer = User::factory()->create();
    Company::factory()->ownedBy($this->buyer)->create(['name' => 'ورشة الأمل', 'whatsapp_phone' => '+963944000111']);
    $this->pending = Rfq::factory()->createdBy($this->buyer)->create([
        'category_id' => null,
        'status' => RfqStatus::PendingReview,
        'description' => 'قطعة دائرية فيها كرات معدنية',
        'closes_at' => now()->addDays(1),
    ]);
});

function triage(Rfq $rfq, array $body): TestResponse
{
    return asAdminUser(test()->admin)->postJson("/api/admin/rfqs/{$rfq->ulid}/triage", $body);
}

it('lists the triage queue oldest first with an allow-listed shape and no quotes', function () {
    $newer = Rfq::factory()->createdBy($this->buyer)->create(['category_id' => null, 'status' => RfqStatus::PendingReview]);
    Rfq::factory()->createdBy($this->buyer)->create(['category_id' => $this->category->id]); // open → not in the queue

    $response = asAdminUser($this->admin)->getJson('/api/admin/rfqs')->assertOk();

    expect($response->json('data.*.id'))->toBe([$this->pending->ulid, $newer->ulid])
        ->and(array_keys($response->json('data.0')))->toBe(['id', 'status', 'category', 'description', 'part_number', 'machine_make', 'machine_model', 'quantity', 'unit', 'urgency', 'area', 'buyer', 'closes_at', 'created_at', 'triaged_at', 'photos_count'])
        ->and($response->json('data.0.buyer'))->toBe(['company_id' => $this->buyer->company()->id, 'name' => 'ورشة الأمل', 'whatsapp_phone' => '+963944000111'])
        ->and($response->json('meta.per_page'))->toBe(20)
        ->and($response->getContent())->not->toContain('unit_price')->not->toContain('password');
});

it('filters other statuses and rejects unknown ones in Arabic', function () {
    $open = Rfq::factory()->createdBy($this->buyer)->create(['category_id' => $this->category->id]);

    expect(asAdminUser($this->admin)->getJson('/api/admin/rfqs?status=open')->assertOk()->json('data.*.id'))->toBe([$open->ulid]);
    asAdminUser($this->admin)->getJson('/api/admin/rfqs?status=deleted')->assertUnprocessable()->assertJsonStructure(['errors' => ['status']]);
});

it('shows photos through the admin route only, with safe headers, and scoped to the RFQ', function () {
    Storage::fake('local');
    Storage::disk('local')->put('rfq-photos/x/a.jpg', 'jpeg-bytes');
    $photo = new RfqAttachment;
    $photo->forceFill(['rfq_id' => $this->pending->id, 'path' => 'rfq-photos/x/a.jpg', 'mime' => 'image/jpeg', 'size' => 10, 'width' => 800, 'height' => 600])->save();
    $other = Rfq::factory()->createdBy($this->buyer)->create();

    $url = asAdminUser($this->admin)->getJson("/api/admin/rfqs/{$this->pending->ulid}")->assertOk()->json('data.photos.0.url');
    expect($url)->toBe("/api/admin/rfqs/{$this->pending->ulid}/photos/{$photo->id}");

    $response = asAdminUser($this->admin)->get($url)->assertOk();
    expect($response->headers->get('Content-Type'))->toBe('image/jpeg')
        ->and($response->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($response->headers->get('Content-Security-Policy'))->toBe("default-src 'none'");

    asAdminUser($this->admin)->get("/api/admin/rfqs/{$other->ulid}/photos/{$photo->id}")->assertNotFound();
    asAdminUser($this->admin)->getJson('/api/admin/rfqs/01ZZZZZZZZZZZZZZZZZZZZZZZZ')->assertNotFound();
});

it('assigns the category: the request opens, gets a fresh answer window, is audited and reaches the right suppliers', function () {
    $this->travelTo(now()->startOfMinute());
    $targeted = supplierUser(CompanyStatus::Approved, [$this->category->id => 'approved']);
    $other = supplierUser(CompanyStatus::Approved, [Category::factory()->create()->id => 'approved']);

    actAs($targeted);
    expect(spa()->getJson('/api/supplier/rfqs')->json('data'))->toBe([]);

    triage($this->pending, ['category_id' => $this->category->id, 'status' => 'closed', 'buyer_company_id' => 999])
        ->assertOk()
        ->assertJsonPath('data.status', 'open')
        ->assertJsonPath('data.category.name', 'بيليا');

    $rfq = $this->pending->refresh();
    expect($rfq->status)->toBe(RfqStatus::Open)
        ->and($rfq->category_id)->toBe($this->category->id)
        ->and($rfq->closes_at->equalTo(now()->addDays(7)))->toBeTrue()
        ->and($rfq->triaged_by)->toBe($this->admin->id)
        ->and($rfq->triaged_at)->not->toBeNull()
        ->and($rfq->buyer_company_id)->toBe($this->buyer->company()->id);

    $log = AuditLog::query()->where('action', 'rfq.triaged')->sole();
    expect($log->actor_user_id)->toBe($this->admin->id)
        ->and($log->subject_type)->toBe('rfq')
        ->and($log->meta)->toMatchArray(['from' => 'pending_review', 'category_id' => $this->category->id]);

    actAs($targeted);
    expect(spa()->getJson('/api/supplier/rfqs')->json('data.*.id'))->toBe([$rfq->ulid]);
    actAs($other);
    expect(spa()->getJson('/api/supplier/rfqs')->json('data'))->toBe([]);
    actAs($this->buyer);
    spa()->getJson("/api/rfqs/{$rfq->ulid}")->assertJsonPath('data.status', 'open')->assertJsonPath('data.accepts_quotes', true);
});

it('validates the category: required, existing, active — in Arabic', function () {
    $inactive = Category::factory()->inactive()->create();

    triage($this->pending, [])->assertUnprocessable()->assertJsonPath('errors.category_id.0', 'اختر التصنيف المناسب للقطعة.');
    triage($this->pending, ['category_id' => $inactive->id])->assertUnprocessable()->assertJsonPath('errors.category_id.0', 'هذا التصنيف غير متاح. اختر تصنيفاً مفعّلاً من القائمة.');
    triage($this->pending, ['category_id' => 999999])->assertUnprocessable();
    triage($this->pending, ['category_id' => 'unknown'])->assertUnprocessable();

    expect($this->pending->refresh()->status)->toBe(RfqStatus::PendingReview)
        ->and(AuditLog::query()->where('action', 'rfq.triaged')->exists())->toBeFalse();
});

it('refuses to triage or reject a request that is no longer pending (409, nothing changed)', function (RfqStatus $status) {
    $this->pending->forceFill(['status' => $status])->save();

    triage($this->pending, ['category_id' => $this->category->id])->assertConflict()
        ->assertJsonPath('message', "لا يمكن تصنيف طلب حالته «{$status->label()}». ربما عالجه مدير آخر أو ألغاه المشتري؛ حدّث الصفحة.");
    asAdminUser($this->admin)->postJson("/api/admin/rfqs/{$this->pending->ulid}/reject", ['reason' => 'ليس طلب قطعة'])->assertConflict()
        ->assertJsonPath('message', "لا يمكن رفض طلب حالته «{$status->label()}». ربما عالجه مدير آخر أو ألغاه المشتري؛ حدّث الصفحة.");

    expect($this->pending->refresh()->status)->toBe($status)
        ->and($this->pending->triaged_at)->toBeNull()
        ->and(AuditLog::query()->whereIn('action', ['rfq.triaged', 'rfq.rejected'])->exists())->toBeFalse();
})->with([RfqStatus::Open, RfqStatus::Cancelled, RfqStatus::Rejected, RfqStatus::Closed, RfqStatus::Expired]);

it('explains a category deactivated after validation in plain Arabic without changing the request', function () {
    $this->category->forceFill(['is_active' => false])->save();
    expect(fn () => app(TriageRfq::class)->assignCategory($this->pending, $this->category, $this->admin))
        ->toThrow(HttpException::class, 'هذا التصنيف معطّل الآن. اختر تصنيفاً مفعّلاً.');
    expect($this->pending->refresh()->status)->toBe(RfqStatus::PendingReview)
        ->and(AuditLog::query()->where('action', 'rfq.triaged')->exists())->toBeFalse();
});

it('lets only the first of two admins decide (second gets 409)', function () {
    triage($this->pending, ['category_id' => $this->category->id])->assertOk();
    triage($this->pending, ['category_id' => Category::factory()->create()->id])->assertConflict();

    expect($this->pending->refresh()->category_id)->toBe($this->category->id)
        ->and(AuditLog::query()->where('action', 'rfq.triaged')->count())->toBe(1);
});

it('rejects with a required reason; the request never reaches suppliers and the buyer sees it rejected', function () {
    $supplier = supplierUser(CompanyStatus::Approved, [$this->category->id => 'approved']);
    $url = "/api/admin/rfqs/{$this->pending->ulid}/reject";

    asAdminUser($this->admin)->postJson($url, [])->assertUnprocessable()->assertJsonPath('errors.reason.0', 'حقل السبب مطلوب.');
    asAdminUser($this->admin)->postJson($url, ['reason' => 'abc'])->assertUnprocessable();

    asAdminUser($this->admin)->postJson($url, ['reason' => 'إعلان وليس طلب قطعة'])->assertOk()->assertJsonPath('data.status', 'rejected');

    expect(AuditLog::query()->where('action', 'rfq.rejected')->sole()->meta)->toBe(['from' => 'pending_review', 'reason' => 'إعلان وليس طلب قطعة']);
    actAs($supplier);
    expect(spa()->getJson('/api/supplier/rfqs')->json('data'))->toBe([]);
    spa()->getJson("/api/supplier/rfqs/{$this->pending->ulid}")->assertNotFound();
    actAs($this->buyer);
    spa()->getJson("/api/rfqs/{$this->pending->ulid}")->assertJsonPath('data.status', 'rejected');
    spa()->postJson("/api/rfqs/{$this->pending->ulid}/cancel")->assertConflict();
});

it('is closed to everyone but active admins — 403 even for unknown ids, 401 for guests, nothing changed', function (string $who) {
    $user = match ($who) {
        'buyer' => $this->buyer,
        'supplier' => supplierUser(CompanyStatus::Approved, [$this->category->id => 'approved']),
        'pending supplier' => supplierUser(CompanyStatus::Pending),
        'suspended admin' => User::factory()->admin()->suspended()->create(),
    };
    actAs($user);
    $ulid = $this->pending->ulid;
    $unknown = '01ZZZZZZZZZZZZZZZZZZZZZZZZ';

    foreach ([
        ['GET', '/api/admin/rfqs'], ['GET', "/api/admin/rfqs/{$ulid}"], ['GET', "/api/admin/rfqs/{$unknown}"],
        ['GET', "/api/admin/rfqs/{$ulid}/photos/1"], ['POST', "/api/admin/rfqs/{$ulid}/triage"], ['POST', "/api/admin/rfqs/{$unknown}/reject"],
        ['GET', '/api/admin/categories'], ['POST', '/api/admin/categories'], ['PATCH', '/api/admin/categories/999999'],
        ['GET', '/api/admin/metrics'], ['GET', '/api/admin/audit-logs'],
    ] as [$method, $url]) {
        spa()->json($method, $url, ['category_id' => $this->category->id, 'reason' => 'محاولة غير مصرح بها', 'name_ar' => 'تصنيف'])->assertForbidden();
    }

    expect($this->pending->refresh()->status)->toBe(RfqStatus::PendingReview)
        ->and(Category::query()->count())->toBe(1);
})->with(['buyer', 'supplier', 'pending supplier', 'suspended admin']);

it('asks guests to log in', function () {
    asGuest();
    $this->getJson('/api/admin/rfqs')->assertUnauthorized();
    $this->postJson("/api/admin/rfqs/{$this->pending->ulid}/triage", ['category_id' => $this->category->id])->assertUnauthorized();
    $this->getJson('/api/admin/metrics')->assertUnauthorized();
    $this->getJson('/api/admin/audit-logs')->assertUnauthorized();
    $this->postJson('/api/admin/categories', ['name_ar' => 'x'])->assertUnauthorized();
});
