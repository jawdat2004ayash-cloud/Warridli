<?php

use App\Enums\CompanyStatus;
use App\Enums\NotificationKind;
use App\Enums\RfqStatus;
use App\Models\Area;
use App\Models\Category;
use App\Models\Company;
use App\Models\CompanyMember;
use App\Models\Rfq;
use App\Models\User;
use App\Services\Notifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

/** Notification rows of $user, oldest first, as [kind, data]. */
function inbox(User $user): array
{
    return DB::table('notifications')->where('notifiable_type', 'user')->where('notifiable_id', $user->id)->orderBy('created_at')->orderBy('id')
        ->get()->map(fn ($row) => [$row->type, json_decode($row->data, true)])->all();
}

function kinds(User $user): array
{
    return array_column(inbox($user), 0);
}

/** A second member in $owner's company. */
function colleagueOf(User $owner): User
{
    $user = User::factory()->create();
    $member = new CompanyMember;
    $member->forceFill(['company_id' => $owner->company()->id, 'user_id' => $user->id, 'role' => 'member'])->save();

    return $user;
}

function notifyRow(User $user, string $kind = 'supplier_approved', array $data = [], ?string $readAt = null, ?string $at = null): string
{
    $id = (string) Str::uuid();
    DB::table('notifications')->insert([
        'id' => $id, 'type' => $kind, 'notifiable_type' => 'user', 'notifiable_id' => $user->id, 'dedupe_key' => 'k-'.$id,
        'data' => json_encode($data), 'read_at' => $readAt, 'created_at' => $at ?? now(), 'updated_at' => $at ?? now(),
    ]);

    return $id;
}

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->bearings = Category::factory()->create(['name_ar' => 'بيليا']);
    $this->buyer = User::factory()->create();
    Company::factory()->ownedBy($this->buyer)->create(['name' => 'ورشة الأمل', 'whatsapp_phone' => '+963944000111']);
});

describe('API: strictly the current user\'s own notifications', function () {
    it('lists own notifications newest first with an allow-listed shape and the unread count', function () {
        $other = User::factory()->create();
        notifyRow($other, data: ['secret' => 'not yours']);
        $old = notifyRow($this->buyer, 'quote_received', ['rfq_id' => 'X'], readAt: now()->toDateTimeString(), at: now()->subHour()->toDateTimeString());
        $new = notifyRow($this->buyer, 'rfq_triaged', ['rfq_id' => 'Y']);

        actAs($this->buyer);
        $response = spa()->getJson('/api/notifications')->assertOk();

        expect($response->json('data.*.id'))->toBe([$new, $old])
            ->and(array_keys($response->json('data.0')))->toBe(['id', 'kind', 'data', 'read', 'created_at'])
            ->and($response->json('data.0'))->toMatchArray(['kind' => 'rfq_triaged', 'data' => ['rfq_id' => 'Y'], 'read' => false])
            ->and($response->json('data.1.read'))->toBeTrue()
            ->and($response->json('meta.unread'))->toBe(1)
            ->and($response->json('meta.per_page'))->toBe(20)
            ->and($response->getContent())->not->toContain('not yours')->not->toContain('dedupe')->not->toContain('notifiable');

        expect(spa()->getJson('/api/notifications/unread-count')->assertOk()->json('data.unread'))->toBe(1);
    });

    it('paginates with a constant number of queries', function () {
        foreach (range(1, 25) as $i) {
            notifyRow($this->buyer, at: now()->subMinutes($i)->toDateTimeString());
        }
        actAs($this->buyer);

        DB::enableQueryLog();
        $page2 = spa()->getJson('/api/notifications?page=2')->assertOk();
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();

        expect($page2->json('data'))->toHaveCount(5)
            ->and($page2->json('meta.last_page'))->toBe(2)
            ->and($queries)->toBeLessThanOrEqual(8);
        spa()->getJson('/api/notifications?page=0')->assertUnprocessable();
    });

    it('marks one of mine as read; someone else\'s or an unknown id is a 404 and stays unread', function () {
        $mine = notifyRow($this->buyer);
        $other = User::factory()->create();
        $theirs = notifyRow($other);
        actAs($this->buyer);

        spa()->postJson("/api/notifications/{$mine}/read")->assertOk()->assertJsonPath('data.read', true);
        spa()->postJson("/api/notifications/{$mine}/read")->assertOk(); // idempotent
        spa()->postJson("/api/notifications/{$theirs}/read")->assertNotFound();
        spa()->postJson('/api/notifications/'.Str::uuid().'/read')->assertNotFound();
        spa()->postJson('/api/notifications/123/read')->assertNotFound();

        expect(DB::table('notifications')->where('id', $theirs)->value('read_at'))->toBeNull()
            ->and(spa()->getJson('/api/notifications/unread-count')->json('data.unread'))->toBe(0);
    });

    it('marks all of mine as read without touching anyone else\'s', function () {
        notifyRow($this->buyer);
        notifyRow($this->buyer);
        $other = User::factory()->create();
        notifyRow($other);
        actAs($this->buyer);

        spa()->postJson('/api/notifications/read-all')->assertOk()->assertJsonPath('data.unread', 0);

        expect(DB::table('notifications')->where('notifiable_id', $this->buyer->id)->whereNull('read_at')->count())->toBe(0)
            ->and(DB::table('notifications')->where('notifiable_id', $other->id)->whereNull('read_at')->count())->toBe(1);
    });

    it('requires a logged-in, active account', function () {
        $id = notifyRow($this->buyer);
        asGuest();
        $this->getJson('/api/notifications')->assertUnauthorized();
        $this->getJson('/api/notifications/unread-count')->assertUnauthorized();
        $this->postJson("/api/notifications/{$id}/read")->assertUnauthorized();
        $this->postJson('/api/notifications/read-all')->assertUnauthorized();

        $suspended = User::factory()->suspended()->create();
        actAs($suspended);
        spa()->getJson('/api/notifications')->assertForbidden();
    });
});

describe('events', function () {
    it('tells every active member of a supplier its review outcome — approval or rejection only', function () {
        $owner = User::factory()->create();
        $supplier = Company::factory()->supplier()->ownedBy($owner)->create();
        $colleague = colleagueOf($owner);
        $suspended = colleagueOf($owner);
        $suspended->forceFill(['suspended_at' => now()])->save();
        $rejectedOwner = User::factory()->create();
        $rejected = Company::factory()->supplier()->ownedBy($rejectedOwner)->create();

        asAdminUser($this->admin)->postJson("/api/admin/companies/{$supplier->id}/approve")->assertOk();
        asAdminUser($this->admin)->postJson("/api/admin/companies/{$rejected->id}/reject", ['reason' => 'لم نتحقق من المحل'])->assertOk();
        asAdminUser($this->admin)->postJson("/api/admin/companies/{$supplier->id}/suspend", ['reason' => 'مخالفة متكررة'])->assertOk();

        expect(kinds($owner))->toBe(['supplier_approved'])
            ->and(kinds($colleague))->toBe(['supplier_approved'])
            ->and(kinds($suspended))->toBe([])
            ->and(inbox($rejectedOwner))->toBe([['supplier_rejected', []]])
            ->and(kinds($this->buyer))->toBe([]);
    });

    it('tells the supplier about each specialty decision, with the category name', function () {
        $belts = Category::factory()->create(['name_ar' => 'سيور']);
        $supplier = supplierUser(CompanyStatus::Approved, [$this->bearings->id => 'pending', $belts->id => 'pending']);
        $company = $supplier->company();

        asAdminUser($this->admin)->postJson("/api/admin/supplier-categories/{$company->id}/{$this->bearings->id}/approve")->assertOk();
        asAdminUser($this->admin)->postJson("/api/admin/supplier-categories/{$company->id}/{$belts->id}/reject")->assertOk();

        expect(inbox($supplier))->toBe([['specialty_approved', ['category' => 'بيليا']], ['specialty_rejected', ['category' => 'سيور']]]);
    });

    it('tells exactly the suppliers approved in the category about a new request — without the buyer\'s identity', function () {
        $target = supplierUser(CompanyStatus::Approved, [$this->bearings->id => 'approved']);
        $targetColleague = colleagueOf($target);
        $pendingSpecialty = supplierUser(CompanyStatus::Approved, [$this->bearings->id => 'pending']);
        $pendingCompany = supplierUser(CompanyStatus::Pending, [$this->bearings->id => 'approved']);
        $otherCategory = supplierUser(CompanyStatus::Approved, [Category::factory()->create()->id => 'approved']);
        $buyerColleague = colleagueOf($this->buyer);

        actAs($this->buyer);
        $ulid = spa()->postJson('/api/rfqs', [
            'description' => 'بيليا مضخة المياه', 'quantity' => 2, 'unit' => 'piece', 'urgency' => 'urgent',
            'area_id' => Area::factory()->create()->id, 'category' => (string) $this->bearings->id,
        ])->assertCreated()->json('data.id');

        expect(inbox($target))->toBe([['rfq_matched', ['rfq_id' => $ulid, 'description' => 'بيليا مضخة المياه', 'category' => 'بيليا']]])
            ->and(kinds($targetColleague))->toBe(['rfq_matched'])
            ->and(kinds($pendingSpecialty))->toBe([])
            ->and(kinds($pendingCompany))->toBe([])
            ->and(kinds($otherCategory))->toBe([])
            ->and(kinds($buyerColleague))->toBe([])
            ->and(DB::table('notifications')->pluck('data')->implode(' '))->not->toContain('ورشة الأمل')->not->toContain('944000111');
    });

    it('notifies nobody for an unknown category until triage; then suppliers and the buyer hear about it', function () {
        $target = supplierUser(CompanyStatus::Approved, [$this->bearings->id => 'approved']);
        actAs($this->buyer);
        $ulid = spa()->postJson('/api/rfqs', [
            'description' => 'قطعة دائرية', 'quantity' => 1, 'unit' => 'piece', 'urgency' => 'normal',
            'area_id' => Area::factory()->create()->id, 'category' => 'unknown',
        ])->assertCreated()->json('data.id');
        expect(DB::table('notifications')->count())->toBe(0);

        asAdminUser($this->admin)->postJson("/api/admin/rfqs/{$ulid}/triage", ['category_id' => $this->bearings->id])->assertOk();
        // A second (refused) attempt changes nothing.
        asAdminUser($this->admin)->postJson("/api/admin/rfqs/{$ulid}/triage", ['category_id' => $this->bearings->id])->assertConflict();

        expect(inbox($target))->toBe([['rfq_matched', ['rfq_id' => $ulid, 'description' => 'قطعة دائرية', 'category' => 'بيليا']]])
            ->and(inbox($this->buyer))->toBe([['rfq_triaged', ['rfq_id' => $ulid, 'description' => 'قطعة دائرية', 'category' => 'بيليا']]]);
    });

    it('tells the buyer when a request is rejected, and no supplier', function () {
        $target = supplierUser(CompanyStatus::Approved, [$this->bearings->id => 'approved']);
        $rfq = Rfq::factory()->createdBy($this->buyer)->create(['category_id' => null, 'status' => RfqStatus::PendingReview]);

        asAdminUser($this->admin)->postJson("/api/admin/rfqs/{$rfq->ulid}/reject", ['reason' => 'إعلان وليس طلب قطعة'])->assertOk();

        expect(kinds($this->buyer))->toBe(['rfq_rejected'])
            ->and(kinds($target))->toBe([])
            ->and(json_encode(inbox($this->buyer)))->not->toContain('إعلان');
    });

    it('tells the buyer company about a supplier\'s first quote only — not edits or re-submits, never the price', function () {
        $supplier = supplierUser(CompanyStatus::Approved, [$this->bearings->id => 'approved']);
        $rfq = Rfq::factory()->createdBy($this->buyer)->create(['category_id' => $this->bearings->id, 'description' => 'بيليا 6205']);
        $buyerColleague = colleagueOf($this->buyer);
        $url = "/api/supplier/rfqs/{$rfq->ulid}/quote";

        actAs($supplier);
        spa()->putJson($url, quotePayload(['unit_price' => '98765']))->assertOk();
        spa()->putJson($url, quotePayload(['unit_price' => '90000']))->assertOk();
        spa()->postJson("{$url}/withdraw")->assertOk();
        spa()->putJson($url, quotePayload())->assertOk();

        expect(inbox($this->buyer))->toBe([['quote_received', ['rfq_id' => $rfq->ulid, 'description' => 'بيليا 6205', 'category' => 'بيليا']]])
            ->and(kinds($buyerColleague))->toBe(['quote_received'])
            ->and(kinds($supplier))->toBe([])
            ->and(json_encode(inbox($this->buyer)))->not->toContain('98765');
    });

    it('tells only the chosen supplier; a repeated or refused choice adds nothing', function () {
        $chosen = supplierUser(CompanyStatus::Approved, [$this->bearings->id => 'approved']);
        $other = supplierUser(CompanyStatus::Approved, [$this->bearings->id => 'approved']);
        $rfq = Rfq::factory()->createdBy($this->buyer)->create(['category_id' => $this->bearings->id]);
        $quote = storedQuote($chosen, $rfq);
        $otherQuote = storedQuote($other, $rfq);

        actAs($this->buyer);
        $select = fn ($q) => spa()->postJson("/api/rfqs/{$rfq->ulid}/quotes/{$q->id}/select", ['seen_updated_at' => $q->updated_at->toISOString()]);
        $select($quote)->assertOk();
        $select($quote)->assertOk();
        $select($otherQuote)->assertConflict();

        expect(inbox($chosen))->toBe([['quote_selected', ['rfq_id' => $rfq->ulid, 'description' => $rfq->description, 'category' => 'بيليا']]])
            ->and(kinds($other))->toBe([]);
    });

    it('never stores the same event twice for a recipient (database-enforced)', function () {
        $notifier = app(Notifier::class);
        expect($notifier->toUsers([$this->buyer->id, $this->buyer->id], NotificationKind::RfqTriaged, 'same-event', []))->toBe(1)
            ->and($notifier->toUsers([$this->buyer->id], NotificationKind::RfqTriaged, 'same-event', []))->toBe(0)
            ->and(DB::table('notifications')->count())->toBe(1);
    });
});
