<?php

use App\Enums\CompanyStatus;
use App\Enums\RfqStatus;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Company;
use App\Models\Rfq;
use App\Models\SupplierCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->bearings = Category::factory()->create(['name_ar' => 'بيليا', 'sort' => 10]);
    $this->belts = Category::factory()->create(['name_ar' => 'سيور', 'sort' => 20]);
});

function patchCategory(Category $category, array $body): TestResponse
{
    return asAdminUser(test()->admin)->patchJson("/api/admin/categories/{$category->id}", $body);
}

it('lists every category, inactive ones last, with what depends on them', function () {
    $old = Category::factory()->inactive()->create(['name_ar' => 'قديم', 'sort' => 0]);
    $buyer = User::factory()->create();
    Company::factory()->ownedBy($buyer)->create();
    Rfq::factory()->createdBy($buyer)->count(2)->create(['category_id' => $this->bearings->id]);
    Rfq::factory()->createdBy($buyer)->create(['category_id' => $this->bearings->id, 'status' => RfqStatus::Closed]);
    supplierUser(CompanyStatus::Approved, [$this->bearings->id => 'approved']);
    supplierUser(CompanyStatus::Approved, [$this->bearings->id => 'pending']);

    $response = asAdminUser($this->admin)->getJson('/api/admin/categories')->assertOk();

    expect($response->json('data.*.id'))->toBe([$this->bearings->id, $this->belts->id, $old->id])
        ->and($response->json('data.0'))->toBe([
            'id' => $this->bearings->id, 'slug' => $this->bearings->slug, 'name' => 'بيليا', 'is_active' => true, 'sort' => 10,
            'rfqs_count' => 3, 'open_rfqs_count' => 2, 'suppliers_count' => 1,
        ])
        ->and($response->json('data.2.is_active'))->toBeFalse();
});

it('adds a category: generated slug, active, appended to the order, audited; client slug/id ignored', function () {
    $response = asAdminUser($this->admin)->postJson('/api/admin/categories', ['name_ar' => '  محركات   كهربائية ', 'slug' => 'hack', 'id' => 1])
        ->assertCreated()
        ->assertJsonPath('data.name', 'محركات كهربائية')
        ->assertJsonPath('data.is_active', true)
        ->assertJsonPath('data.sort', 30)
        ->assertJsonPath('data.rfqs_count', 0);

    expect($response->json('data.slug'))->toStartWith('c-')->not->toBe('hack')
        ->and($response->json('data.id'))->not->toBe(1);
    $log = AuditLog::query()->where('action', 'category.created')->sole();
    expect($log->actor_user_id)->toBe($this->admin->id)
        ->and($log->subject_type)->toBe('category')
        ->and($log->meta)->toBe(['name' => 'محركات كهربائية', 'sort' => 30]);

    // Immediately offered to buyers.
    expect(spa()->getJson('/api/categories')->json('data.*.name'))->toContain('محركات كهربائية');
});

it('validates names in Arabic: required, unique (ignoring extra spaces), length; new ones cannot start inactive', function () {
    $post = fn (array $body) => asAdminUser($this->admin)->postJson('/api/admin/categories', $body);

    $post([])->assertUnprocessable()->assertJsonPath('errors.name_ar.0', 'اكتب اسم التصنيف.');
    $post(['name_ar' => ' بيليا '])->assertUnprocessable()->assertJsonPath('errors.name_ar.0', 'يوجد تصنيف بهذا الاسم. اختر اسماً مختلفاً أو عدّل التصنيف الموجود.');
    $post(['name_ar' => 'ب'])->assertUnprocessable();
    $post(['name_ar' => str_repeat('ب', 101)])->assertUnprocessable();
    $post(['name_ar' => 'جديد', 'is_active' => false])->assertUnprocessable()->assertJsonPath('errors.is_active.0', 'التصنيف الجديد يُضاف مفعّلاً.');
    $post(['name_ar' => 'جديد', 'sort' => -1])->assertUnprocessable();

    expect(Category::query()->count())->toBe(2);
});

it('renames and reorders with one audit entry; keeping its own name is not a duplicate; a repeat is not audited', function () {
    patchCategory($this->bearings, ['name_ar' => 'بيليا ورولمان', 'sort' => 5])->assertOk()->assertJsonPath('data.name', 'بيليا ورولمان');
    patchCategory($this->bearings, ['name_ar' => 'بيليا ورولمان', 'sort' => 5])->assertOk();
    patchCategory($this->bearings, ['name_ar' => 'سيور'])->assertUnprocessable();

    $log = AuditLog::query()->where('action', 'category.updated')->sole();
    expect($log->meta)->toBe(['changed' => 'name_ar,sort', 'name_from' => 'بيليا', 'name' => 'بيليا ورولمان', 'is_active' => true])
        ->and($this->bearings->refresh()->slug)->not->toBe('');
});

it('deactivates without touching existing requests or approved specialties; buyers and triage can no longer use it', function () {
    $buyer = User::factory()->create();
    Company::factory()->ownedBy($buyer)->create();
    $open = Rfq::factory()->createdBy($buyer)->create(['category_id' => $this->bearings->id]);
    $supplier = supplierUser(CompanyStatus::Approved, [$this->bearings->id => 'approved']);
    $pending = Rfq::factory()->createdBy($buyer)->create(['category_id' => null, 'status' => RfqStatus::PendingReview]);

    patchCategory($this->bearings, ['is_active' => false])->assertOk()->assertJsonPath('data.is_active', false);
    patchCategory($this->bearings, ['is_active' => false])->assertOk(); // double click
    expect(AuditLog::query()->where('action', 'category.deactivated')->count())->toBe(1);

    // Existing data intact.
    expect($open->refresh()->category_id)->toBe($this->bearings->id)
        ->and($open->status)->toBe(RfqStatus::Open)
        ->and(SupplierCategory::query()->where('category_id', $this->bearings->id)->value('status')->value)->toBe('approved');

    // The supplier still receives the open request…
    actAs($supplier);
    expect(spa()->getJson('/api/supplier/rfqs')->json('data.*.id'))->toBe([$open->ulid]);
    // …and saving its specialties form (which no longer lists the category) does not silently drop it (D36).
    spa()->putJson('/api/supplier/categories', ['category_ids' => [$this->belts->id]])->assertOk();
    expect(SupplierCategory::query()->where('company_id', $supplier->company()->id)->pluck('category_id')->sort()->values()->all())
        ->toBe([$this->bearings->id, $this->belts->id]);
    spa()->putJson('/api/supplier/categories', ['category_ids' => [$this->bearings->id]])->assertUnprocessable();

    // Not offered to buyers, refused on create, refused in triage.
    asGuest();
    expect(spa()->getJson('/api/categories')->json('data.*.id'))->toBe([$this->belts->id]);
    actAs($buyer);
    spa()->postJson('/api/rfqs', ['description' => 'بيليا', 'quantity' => 1, 'unit' => 'piece', 'urgency' => 'normal', 'area_id' => $open->area_id, 'category' => (string) $this->bearings->id])
        ->assertUnprocessable()->assertJsonValidationErrors('category');
    asAdminUser($this->admin)->postJson("/api/admin/rfqs/{$pending->ulid}/triage", ['category_id' => $this->bearings->id])->assertUnprocessable();

    // Reactivate.
    patchCategory($this->bearings, ['is_active' => true])->assertOk();
    expect(AuditLog::query()->where('action', 'category.activated')->count())->toBe(1);
    asGuest();
    expect(spa()->getJson('/api/categories')->json('data.*.id'))->toBe([$this->bearings->id, $this->belts->id]);
});

it('has no way to delete a category and 404s unknown ones', function () {
    asAdminUser($this->admin)->deleteJson("/api/admin/categories/{$this->bearings->id}")->assertMethodNotAllowed();
    asAdminUser($this->admin)->patchJson('/api/admin/categories/999999', ['name_ar' => 'جديد'])->assertNotFound();
    expect(Category::query()->count())->toBe(2);
});
