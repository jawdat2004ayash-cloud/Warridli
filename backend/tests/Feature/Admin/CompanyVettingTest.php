<?php

use App\Enums\CompanyStatus;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->owner = User::factory()->create(['email' => 'supplier@example.com', 'password' => Hash::make('secret123abc')]);
    $this->supplier = Company::factory()->supplier()->ownedBy($this->owner)->create(['name' => 'مستودع المحامل']);
});

function asAdmin(): TestCase
{
    actAs(test()->admin);

    return spa();
}

function companyAction(Company $company, string $transition, array $body = []): TestResponse
{
    return asAdmin()->postJson("/api/admin/companies/{$company->id}/{$transition}", $body);
}

it('lists the pending review queue oldest first with an allow-listed shape', function () {
    $newer = Company::factory()->supplier()->ownedBy()->create();
    Company::factory()->ownedBy()->create(); // approved buyer

    $response = asAdmin()->getJson('/api/admin/companies?status=pending')->assertOk();

    expect($response->json('data.*.id'))->toBe([$this->supplier->id, $newer->id])
        ->and(array_keys($response->json('data.0')))->toBe(['id', 'type', 'name', 'whatsapp_phone', 'area', 'address_text', 'status', 'verified_at', 'created_at', 'members', 'categories'])
        ->and(array_keys($response->json('data.0.members.0')))->toBe(['user_id', 'name', 'email', 'role', 'suspended'])
        ->and($response->json('data.0.members.0.email'))->toBe('supplier@example.com')
        ->and($response->json('meta.per_page'))->toBe(20)
        ->and($response->getContent())->not->toContain('password')->not->toContain('remember_token');
});

it('filters by type and rejects unknown filter values in Arabic', function () {
    Company::factory()->ownedBy()->create();

    expect(asAdmin()->getJson('/api/admin/companies?type=buyer')->assertOk()->json('data.*.type'))->toBe(['buyer']);

    asAdmin()->getJson('/api/admin/companies?status=deleted')
        ->assertUnprocessable()
        ->assertJsonPath('errors.status.0', 'القيمة المختارة في حقل الحالة غير صحيحة.');
});

it('approves a pending supplier and records who, what, when and the change', function () {
    companyAction($this->supplier, 'approve')
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');

    $this->supplier->refresh();
    expect($this->supplier->status)->toBe(CompanyStatus::Approved)
        ->and($this->supplier->verified_by)->toBe($this->admin->id)
        ->and($this->supplier->verified_at)->not->toBeNull();

    $log = AuditLog::query()->where('action', 'company.approved')->sole();
    expect($log->actor_user_id)->toBe($this->admin->id)
        ->and($log->subject_type)->toBe('company')
        ->and($log->subject_id)->toBe($this->supplier->id)
        ->and($log->meta)->toBe(['from' => 'pending', 'to' => 'approved', 'company_type' => 'supplier', 'reason' => null, 'sessions_revoked' => 0])
        ->and($log->ip)->not->toBeNull()
        ->and($log->created_at)->not->toBeNull();
});

it('requires a reason to reject, then rejects', function () {
    companyAction($this->supplier, 'reject')
        ->assertUnprocessable()
        ->assertJsonPath('errors.reason.0', 'حقل السبب مطلوب.');
    expect($this->supplier->refresh()->status)->toBe(CompanyStatus::Pending);

    companyAction($this->supplier, 'reject', ['reason' => 'السجل التجاري غير واضح'])
        ->assertOk()
        ->assertJsonPath('data.status', 'rejected');

    expect(AuditLog::query()->where('action', 'company.rejected')->sole()->meta['reason'])->toBe('السجل التجاري غير واضح');
});

it('ignores status fields smuggled into the body', function () {
    companyAction($this->supplier, 'reject', ['reason' => 'بيانات ناقصة', 'status' => 'approved', 'verified_by' => 999])
        ->assertOk();

    expect($this->supplier->refresh()->status)->toBe(CompanyStatus::Rejected)
        ->and($this->supplier->verified_by)->toBe($this->admin->id);
});

it('lets an admin reconsider a rejected supplier', function () {
    $this->supplier->forceFill(['status' => CompanyStatus::Rejected])->save();

    companyAction($this->supplier, 'approve')->assertOk()->assertJsonPath('data.status', 'approved');
});

it('refuses transitions that do not fit the current status with an Arabic 409 and changes nothing', function (string $from, string $transition) {
    $this->supplier->forceFill(['status' => $from])->save();

    $response = companyAction($this->supplier, $transition, ['reason' => 'سبب الاختبار']);

    $response->assertStatus(409);
    expect($response->json('message'))->toContain('لا يمكن تنفيذ')->toContain(CompanyStatus::from($from)->label())
        ->and($this->supplier->refresh()->status->value)->toBe($from)
        ->and(AuditLog::query()->where('action', 'like', 'company.%')->count())->toBe(0);
})->with([
    'approve twice' => ['approved', 'approve'],
    'reject approved' => ['approved', 'reject'],
    'reject rejected' => ['rejected', 'reject'],
    'suspend pending' => ['pending', 'suspend'],
    'suspend suspended' => ['suspended', 'suspend'],
    'reactivate approved' => ['approved', 'reactivate'],
    'reactivate pending' => ['pending', 'reactivate'],
    'approve suspended' => ['suspended', 'approve'],
]);

it('never reviews buyer companies but can suspend them', function () {
    $buyer = Company::factory()->ownedBy()->create();

    companyAction($buyer, 'approve')->assertStatus(409)
        ->assertJsonPath('message', 'حسابات المشترين لا تحتاج إلى مراجعة. يمكن تعليقها أو إعادة تفعيلها فقط.');
    companyAction($buyer, 'reject', ['reason' => 'سبب الاختبار'])->assertStatus(409);

    companyAction($buyer, 'suspend', ['reason' => 'طلبات وهمية متكررة'])->assertOk()->assertJsonPath('data.status', 'suspended');
});

it('blocks every member of a suspended company immediately and lets them back after reactivation', function () {
    $this->supplier->forceFill(['status' => CompanyStatus::Approved])->save();

    companyAction($this->supplier, 'suspend', ['reason' => 'شكاوى من المشترين'])->assertOk();

    // The member's next request (fresh model, as a real request would load it).
    actAs($this->owner);
    spa()->getJson('/api/me')
        ->assertForbidden()
        ->assertJsonPath('message', 'حساب شركتك موقوف حالياً. تواصل مع إدارة ورّدلي لمعرفة السبب.');
    $this->assertGuest('web');

    spa()->postJson('/api/auth/login', ['email' => 'supplier@example.com', 'password' => 'secret123abc'])->assertForbidden();
    $this->assertGuest('web');

    companyAction($this->supplier, 'reactivate')->assertOk()->assertJsonPath('data.status', 'approved');

    asGuest();
    spa()->postJson('/api/auth/login', ['email' => 'supplier@example.com', 'password' => 'secret123abc'])->assertOk();
    expect(AuditLog::query()->where('action', 'company.reactivated')->sole()->meta)->toMatchArray(['from' => 'suspended', 'to' => 'approved']);
});

it('deletes the stored sessions of the members of a suspended company, and only theirs', function () {
    config(['session.driver' => 'database']);
    $this->supplier->forceFill(['status' => CompanyStatus::Approved])->save();
    $bystander = User::factory()->create();
    foreach ([$this->owner->id, $this->owner->id, $bystander->id] as $i => $userId) {
        DB::table('sessions')->insert(['id' => "s{$i}", 'user_id' => $userId, 'payload' => '', 'last_activity' => time()]);
    }

    companyAction($this->supplier, 'suspend', ['reason' => 'شكاوى من المشترين'])->assertOk();

    expect(DB::table('sessions')->where('user_id', $this->owner->id)->count())->toBe(0)
        ->and(DB::table('sessions')->where('user_id', $bystander->id)->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'company.suspended')->sole()->meta['sessions_revoked'])->toBe(2);
});

it('forbids non-admins on every admin company endpoint without revealing which IDs exist', function (string $who) {
    $user = $who === 'suspended admin' ? User::factory()->admin()->suspended()->create() : User::factory()->create();
    match ($who) {
        'buyer' => Company::factory()->ownedBy($user)->create(),
        'approved supplier' => Company::factory()->supplier(CompanyStatus::Approved)->ownedBy($user)->create(),
        default => null,
    };
    $this->actingAs($who === 'pending supplier (own company)' ? $this->owner : $user);

    spa()->getJson('/api/admin/companies')->assertForbidden();
    foreach (['approve', 'reject', 'suspend', 'reactivate'] as $transition) {
        spa()->postJson("/api/admin/companies/{$this->supplier->id}/{$transition}", ['reason' => 'محاولة غير مصرح بها'])->assertForbidden();
    }
    spa()->postJson('/api/admin/companies/999999/approve')->assertForbidden();

    expect($this->supplier->refresh()->status)->toBe(CompanyStatus::Pending)
        ->and(AuditLog::query()->where('action', 'like', 'company.%')->count())->toBe(0);
})->with(['buyer', 'approved supplier', 'pending supplier (own company)', 'suspended admin']);

it('answers unknown companies and unknown actions with an Arabic 404 for admins', function () {
    asAdmin()->postJson('/api/admin/companies/999999/approve')->assertNotFound()
        ->assertJsonPath('message', 'الصفحة أو العنصر المطلوب غير موجود.');
    asAdmin()->postJson("/api/admin/companies/{$this->supplier->id}/delete")->assertNotFound();
});

it('finds suppliers waiting for a specialty decision, oldest first, whatever the company status', function () {
    $category = Category::factory()->create();
    $approvedWaiting = supplierUser(CompanyStatus::Approved, [$category->id => 'pending'])->company();
    supplierUser(CompanyStatus::Approved, [$category->id => 'approved']);
    $pendingWaiting = supplierUser(CompanyStatus::Pending, [$category->id => 'pending'])->company();

    expect(asAdmin()->getJson('/api/admin/companies?pending_categories=1')->assertOk()->json('data.*.id'))
        ->toBe([$approvedWaiting->id, $pendingWaiting->id]);
});

it('searches by company name or member email, treating % and _ literally', function () {
    Company::factory()->ownedBy()->create(['name' => 'ورشة الشام']);

    expect(asAdmin()->getJson('/api/admin/companies?q='.urlencode('المحامل'))->json('data.*.id'))->toBe([$this->supplier->id])
        ->and(asAdmin()->getJson('/api/admin/companies?q=supplier@exa')->json('data.*.id'))->toBe([$this->supplier->id])
        ->and(asAdmin()->getJson('/api/admin/companies?q=%25%25')->json('data'))->toBe([]);
    asAdmin()->getJson('/api/admin/companies?q=a')->assertUnprocessable();
});
