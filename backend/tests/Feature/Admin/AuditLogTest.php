<?php

use App\Enums\RfqStatus;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Company;
use App\Models\Rfq;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->admin()->create(['name' => 'المدير']);
    $this->owner = User::factory()->create();
    $this->supplier = Company::factory()->supplier()->ownedBy($this->owner)->create(['name' => 'مستودع النور']);
});

function auditAt(string $action, ?Model $subject, array $meta, ?User $actor, string $at): AuditLog
{
    $log = app(AuditLogger::class)->record($action, $subject, $meta, $actor);
    $log->forceFill(['created_at' => Carbon::parse($at)])->save();

    return $log;
}

it('shows who did what, to what, and when — newest first, with readable subjects', function () {
    asAdminUser($this->admin)->postJson("/api/admin/companies/{$this->supplier->id}/approve")->assertOk();
    $category = Category::factory()->create(['name_ar' => 'بيليا']);
    asAdminUser($this->admin)->patchJson("/api/admin/categories/{$category->id}", ['is_active' => false])->assertOk();

    $response = asAdminUser($this->admin)->getJson('/api/admin/audit-logs')->assertOk();

    expect($response->json('data.*.action'))->toBe(['category.deactivated', 'company.approved'])
        ->and($response->json('meta.per_page'))->toBe(30)
        ->and(array_keys($response->json('data.1')))->toBe(['id', 'action', 'actor', 'subject', 'meta', 'ip', 'created_at'])
        ->and($response->json('data.1.actor'))->toBe(['id' => $this->admin->id, 'name' => 'المدير', 'email' => $this->admin->email, 'is_admin' => true])
        ->and($response->json('data.1.subject'))->toBe(['type' => 'company', 'id' => $this->supplier->id, 'label' => 'مستودع النور', 'ref' => null])
        ->and($response->json('data.0.subject.label'))->toBe('بيليا')
        ->and($response->json('data.1.meta.to'))->toBe('approved');
});

it('gives RFQ subjects their public id and a short label', function () {
    $buyer = User::factory()->create();
    Company::factory()->ownedBy($buyer)->create();
    $rfq = Rfq::factory()->createdBy($buyer)->create(['category_id' => null, 'status' => RfqStatus::PendingReview, 'description' => str_repeat('بيليا ', 30)]);
    asAdminUser($this->admin)->postJson("/api/admin/rfqs/{$rfq->ulid}/reject", ['reason' => 'طلب مكرر'])->assertOk();

    $entry = asAdminUser($this->admin)->getJson('/api/admin/audit-logs?group=rfq')->assertOk()->json('data.0');
    expect($entry['subject']['ref'])->toBe($rfq->ulid)
        ->and(mb_strlen($entry['subject']['label']))->toBeLessThanOrEqual(63)
        ->and($entry['meta'])->toBe(['from' => 'pending_review', 'reason' => 'طلب مكرر']);
});

it('never returns secret-looking meta keys, even if one was stored by mistake', function () {
    auditAt('auth.login', $this->owner, ['token' => 'abc123', 'password_hint' => 'x', 'remember' => 'y', 'from' => 'ok'], $this->owner, '2026-10-01 10:00');

    $response = asAdminUser($this->admin)->getJson('/api/admin/audit-logs')->assertOk();
    expect($response->json('data.0.meta'))->toBe(['from' => 'ok'])
        ->and($response->getContent())->not->toContain('abc123')->not->toContain('password":')->not->toContain('remember_token');
});

it('filters by group, actor kind, subject and Damascus calendar days', function () {
    auditAt('company.approved', $this->supplier, [], $this->admin, '2026-10-10 09:00');
    auditAt('auth.login', $this->owner, [], $this->owner, '2026-10-12 09:00');
    auditAt('rfq.expired', $this->supplier, [], null, '2026-10-14 21:30'); // = 15 Oct 00:30 in Damascus
    $otherCompany = Company::factory()->ownedBy()->create();
    auditAt('company.suspended', $otherCompany, ['reason' => 'مخالفة'], $this->admin, '2026-10-16 09:00');
    $get = fn (string $query) => asAdminUser($this->admin)->getJson("/api/admin/audit-logs?{$query}")->assertOk()->json('data.*.action');

    expect($get('group=company'))->toBe(['company.suspended', 'company.approved'])
        ->and($get('actor=system'))->toBe(['rfq.expired'])
        ->and($get('actor=admin'))->toBe(['company.suspended', 'company.approved'])
        ->and($get("subject_type=company&subject_id={$this->supplier->id}"))->toBe(['rfq.expired', 'company.approved'])
        ->and($get('from=2026-10-15&to=2026-10-15'))->toBe(['rfq.expired'])
        ->and($get('from=2026-10-11&to=2026-10-14'))->toBe(['auth.login']);
});

it('rejects invalid filters in Arabic and treats LIKE wildcards literally', function () {
    auditAt('company.approved', $this->supplier, [], $this->admin, '2026-10-10 09:00');

    asAdminUser($this->admin)->getJson('/api/admin/audit-logs?group=%25')->assertUnprocessable();
    asAdminUser($this->admin)->getJson('/api/admin/audit-logs?from=2026-10-20&to=2026-10-01')->assertUnprocessable()->assertJsonStructure(['errors' => ['to']]);
    asAdminUser($this->admin)->getJson('/api/admin/audit-logs?from=yesterday')->assertUnprocessable();
    asAdminUser($this->admin)->getJson('/api/admin/audit-logs?subject_type=company')->assertUnprocessable();
    asAdminUser($this->admin)->getJson('/api/admin/audit-logs?subject_type=password_reset_tokens&subject_id=1')->assertUnprocessable();
});

it('is read-only: no route edits or deletes audit entries', function () {
    $log = auditAt('company.approved', $this->supplier, [], $this->admin, '2026-10-10 09:00');

    asAdminUser($this->admin)->deleteJson('/api/admin/audit-logs')->assertMethodNotAllowed();
    asAdminUser($this->admin)->deleteJson("/api/admin/audit-logs/{$log->id}")->assertNotFound();
    expect(AuditLog::query()->count())->toBe(1);
});
