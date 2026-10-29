<?php

use App\Enums\CompanyStatus;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Company;
use App\Models\SupplierCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->bearings = Category::factory()->create(['name_ar' => 'بيليا', 'sort' => 1]);
    $this->belts = Category::factory()->create(['name_ar' => 'سيور', 'sort' => 2]);
    $this->supplier = supplierUser(CompanyStatus::Pending);
    $this->company = $this->supplier->company();
    $this->admin = User::factory()->admin()->create();
});

it('lets a supplier under review choose specialties, which start as pending', function () {
    $this->actingAs($this->supplier);

    spa()->putJson('/api/supplier/categories', ['category_ids' => [$this->bearings->id]])
        ->assertOk()
        ->assertExactJson(['data' => [
            ['id' => $this->bearings->id, 'name' => 'بيليا', 'status' => 'pending'],
            ['id' => $this->belts->id, 'name' => 'سيور', 'status' => null],
        ]]);

    expect(AuditLog::query()->where('action', 'supplier_category.requested')->sole()->meta)->toBe(['category_id' => $this->bearings->id]);
});

it('keeps approved specialties approved and removes unchecked ones', function () {
    $row = new SupplierCategory;
    $row->forceFill(['company_id' => $this->company->id, 'category_id' => $this->bearings->id, 'status' => 'approved'])->save();
    $this->actingAs($this->supplier);

    spa()->putJson('/api/supplier/categories', ['category_ids' => [$this->bearings->id, $this->belts->id]])->assertOk()
        ->assertJsonPath('data.0.status', 'approved')->assertJsonPath('data.1.status', 'pending');

    spa()->putJson('/api/supplier/categories', ['category_ids' => [$this->belts->id]])->assertOk()
        ->assertJsonPath('data.0.status', null);

    expect(AuditLog::query()->where('action', 'supplier_category.removed')->sole()->meta)->toBe(['category_id' => $this->bearings->id, 'was' => 'approved']);
});

it('rejects inactive or unknown categories', function () {
    $inactive = Category::factory()->inactive()->create();
    $this->actingAs($this->supplier);

    spa()->putJson('/api/supplier/categories', ['category_ids' => [$inactive->id]])->assertUnprocessable()
        ->assertJsonPath('errors', fn ($errors) => ($errors['category_ids.0'][0] ?? null) === 'أحد التصنيفات المختارة غير متاح. حدّث الصفحة واختر من القائمة.');
    spa()->putJson('/api/supplier/categories', [])->assertUnprocessable();
    expect(SupplierCategory::query()->count())->toBe(0);
});

it('is for supplier accounts only', function () {
    $buyer = User::factory()->create();
    Company::factory()->ownedBy($buyer)->create();
    $this->actingAs($buyer);

    spa()->getJson('/api/supplier/categories')->assertForbidden()->assertJsonPath('message', 'تخصصات المورّد متاحة لحسابات المورّدين فقط.');
    spa()->putJson('/api/supplier/categories', ['category_ids' => [$this->bearings->id]])->assertForbidden();
    $this->getJson('/api/supplier/categories')->assertForbidden(); // still logged in as buyer
});

it('lets an admin approve or reject a pending specialty, audited, and shows them in the admin company view', function () {
    $this->actingAs($this->supplier);
    spa()->putJson('/api/supplier/categories', ['category_ids' => [$this->bearings->id, $this->belts->id]])->assertOk();

    actAs($this->admin);
    spa()->postJson("/api/admin/supplier-categories/{$this->company->id}/{$this->bearings->id}/approve")->assertOk()
        ->assertJsonPath('data.categories', [
            ['id' => $this->bearings->id, 'name' => 'بيليا', 'status' => 'approved'],
            ['id' => $this->belts->id, 'name' => 'سيور', 'status' => 'pending'],
        ]);
    spa()->postJson("/api/admin/supplier-categories/{$this->company->id}/{$this->belts->id}/reject", ['reason' => 'لا يبيع سيوراً'])->assertOk()
        ->assertJsonCount(1, 'data.categories');

    spa()->postJson("/api/admin/supplier-categories/{$this->company->id}/{$this->belts->id}/approve")->assertStatus(409)
        ->assertJsonPath('message', 'لا يوجد طلب تخصص قيد المراجعة لهذا المورّد في هذا التصنيف.');

    $row = SupplierCategory::query()->sole();
    expect([$row->status->value, $row->approved_by])->toBe(['approved', $this->admin->id])
        ->and(AuditLog::query()->where('action', 'supplier_category.rejected')->sole()->meta)->toBe(['category_id' => $this->belts->id, 'reason' => 'لا يبيع سيوراً']);
});

it('forbids non-admins from approving specialties, even their own', function () {
    $this->actingAs($this->supplier);
    spa()->putJson('/api/supplier/categories', ['category_ids' => [$this->bearings->id]])->assertOk();

    spa()->postJson("/api/admin/supplier-categories/{$this->company->id}/{$this->bearings->id}/approve")->assertForbidden();
    expect(SupplierCategory::query()->sole()->status->value)->toBe('pending');
});

it('approves a supplier and its pending specialties from the CLI, audited, after confirmation', function () {
    $this->actingAs($this->supplier);
    spa()->putJson('/api/supplier/categories', ['category_ids' => [$this->bearings->id]])->assertOk();

    $this->artisan('warridli:approve-supplier', ['email' => $this->supplier->email])
        ->expectsConfirmation('Approve this supplier and these specialties?', 'no')
        ->assertSuccessful();
    expect($this->company->refresh()->status)->toBe(CompanyStatus::Pending);

    $this->artisan('warridli:approve-supplier', ['email' => strtoupper($this->supplier->email), '--force' => true])->assertSuccessful();

    expect($this->company->refresh()->status)->toBe(CompanyStatus::Approved)
        ->and(SupplierCategory::query()->sole()->status->value)->toBe('approved')
        ->and(AuditLog::query()->whereIn('action', ['company.approved', 'supplier_category.approved'])->whereNull('actor_user_id')->count())->toBe(2);
});

it('refuses to approve buyers or unknown emails from the CLI', function () {
    $buyer = User::factory()->create();
    Company::factory()->ownedBy($buyer)->create();

    $this->artisan('warridli:approve-supplier', ['email' => $buyer->email, '--force' => true])->assertFailed();
    $this->artisan('warridli:approve-supplier', ['email' => 'nobody@example.com', '--force' => true])->assertFailed();
});
