<?php

use App\Enums\CompanyStatus;
use App\Models\Area;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Company;
use App\Models\Rfq;
use App\Models\User;
use App\Services\Notifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

/** Only aggregate synthetic measurements are persisted, and only when explicitly requested. */
function m5cMeasurement(string $key, array $data): void
{
    $label = getenv('M5C_PROFILE');
    if (! in_array($label, ['baseline', 'after'], true)) {
        return;
    }
    $path = storage_path("framework/testing/m5c-{$label}.json");
    if (! is_dir(dirname($path))) {
        mkdir(dirname($path), 0755, true);
    }
    $report = is_file($path) ? json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR) : [];
    $report[$key] = $data;
    file_put_contents($path, json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
}

it('keeps list query counts bounded while returning complete authorized pages', function () {
    $category = Category::factory()->create();
    $buyer = User::factory()->create();
    Company::factory()->ownedBy($buyer)->create();
    $supplier = supplierUser(CompanyStatus::Approved, [$category->id => 'approved']);
    $admin = User::factory()->admin()->create();
    $rfqs = Rfq::factory()->count(25)->createdBy($buyer)->create(['category_id' => $category->id]);
    $one = $rfqs->first();
    foreach (range(1, 25) as $i) {
        $peer = supplierUser(CompanyStatus::Approved, [$category->id => 'approved']);
        storedQuote($peer, $one);
        $row = new AuditLog;
        $row->forceFill(['action' => 'company.approved', 'actor_user_id' => $admin->id, 'subject_type' => 'company', 'subject_id' => $peer->company()->id])->save();
        DB::table('notifications')->insert([
            'id' => (string) Str::uuid(), 'type' => 'quote_received', 'notifiable_type' => 'user', 'notifiable_id' => $buyer->id,
            'dedupe_key' => "profile:{$i}", 'data' => '{}', 'created_at' => now(), 'updated_at' => now(),
        ]);
    }
    $measure = function (User $user, string $url, int $expected, int $budget) {
        actAs($user);
        DB::flushQueryLog();
        DB::enableQueryLog();
        $start = hrtime(true);
        $response = spa()->getJson($url)->assertOk();
        $elapsed = (hrtime(true) - $start) / 1e6;
        $queries = DB::getQueryLog();
        DB::disableQueryLog();
        expect($response->json('data'))->toHaveCount($expected)
            ->and(count($queries))->toBeLessThanOrEqual($budget);
        $key = preg_replace('#/rfqs/[^/]+/quotes#', '/rfqs/{ulid}/quotes', $url);
        m5cMeasurement($key, ['queries' => count($queries), 'sql_ms' => round(array_sum(array_column($queries, 'time')), 3), 'request_ms' => round($elapsed, 3), 'payload_bytes' => strlen($response->getContent()), 'returned' => $expected]);
    };
    $measure($buyer, '/api/rfqs?page=1', 20, 10);
    $measure($supplier, '/api/supplier/rfqs?tab=new&page=1', 20, 10);
    $measure($buyer, "/api/rfqs/{$one->ulid}/quotes", 25, 10);
    $measure($buyer, '/api/notifications?page=1', 20, 8);
    $measure($admin, '/api/admin/companies?page=1', 20, 12);
    $measure($admin, '/api/admin/audit-logs?page=1', 25, 10);
    $measure($admin, '/api/admin/rfqs?status=open&page=1', 20, 12);
    foreach ($rfqs as $rfq) {
        storedQuote($supplier, $rfq);
    }
    $measure($supplier, '/api/supplier/rfqs?tab=quoted&page=1', 20, 10);
});

it('bounds specialization review queries and refuses a duplicate review without extra side effects', function () {
    $admin = User::factory()->admin()->create();
    $categories = Category::factory()->count(25)->create();
    $supplier = supplierUser(CompanyStatus::Approved, $categories->mapWithKeys(fn ($c) => [$c->id => 'pending'])->all());
    $company = $supplier->company();
    actAs($admin);
    DB::flushQueryLog();
    DB::enableQueryLog();
    $response = spa()->getJson('/api/admin/companies?pending_categories=1')->assertOk();
    $queries = count(DB::getQueryLog());
    DB::disableQueryLog();
    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.categories'))->toHaveCount(25)
        ->and($queries)->toBeLessThanOrEqual(12);
    m5cMeasurement('specialty_queue_25', ['queries' => $queries, 'payload_bytes' => strlen($response->getContent())]);

    DB::flushQueryLog();
    DB::enableQueryLog();
    $url = "/api/admin/supplier-categories/{$company->id}/{$categories->first()->id}/approve";
    spa()->postJson($url)->assertOk()->assertJsonCount(25, 'data.categories');
    $queries = count(DB::getQueryLog());
    DB::disableQueryLog();
    expect($queries)->toBeLessThanOrEqual(25);
    m5cMeasurement('specialty_approval_25', ['queries' => $queries]);
    spa()->postJson($url)->assertConflict();
    expect(AuditLog::query()->count())->toBe(1)
        ->and(DB::table('notifications')->count())->toBe(1);
});

it('profiles expiry access on many future requests without touching development data', function () {
    $user = User::factory()->create();
    $company = Company::factory()->ownedBy($user)->create();
    $category = Category::factory()->create();
    $area = Area::factory()->create();
    $rows = [];
    foreach (range(1, 10010) as $i) {
        $rows[] = [
            'ulid' => (string) Str::ulid(), 'buyer_company_id' => $company->id, 'created_by' => $user->id,
            'category_id' => $category->id, 'area_id' => $area->id, 'status' => 'open', 'description' => 'synthetic profile part',
            'quantity' => 1, 'unit' => 'piece', 'urgency' => 'normal',
            'closes_at' => ($i <= 10000 ? now()->addDay() : now()->subDay())->toDateTimeString(),
            'created_at' => now()->toDateTimeString(), 'updated_at' => now()->toDateTimeString(),
        ];
        if (count($rows) === 500 || $i === 10010) {
            DB::table('rfqs')->insert($rows);
            $rows = [];
        }
    }
    $query = Rfq::query()->where('status', 'open')->where('closes_at', '<=', now())->select(['id', 'closes_at'])->orderBy('id')->limit(200);
    expect($query->get())->toHaveCount(10);
    $analysis = DB::selectOne('ANALYZE FORMAT=JSON '.$query->toSql(), $query->getBindings());
    $plan = json_decode(array_values((array) $analysis)[0], true, flags: JSON_THROW_ON_ERROR);
    $tables = [];
    $walk = function (array $node) use (&$walk, &$tables) {
        if (isset($node['table_name'])) {
            $tables[] = array_intersect_key($node, array_flip(['table_name', 'access_type', 'key', 'rows', 'r_rows', 'r_loops', 'r_filtered']));
        }
        foreach ($node as $child) {
            if (is_array($child)) {
                $walk($child);
            }
        }
    };
    $walk($plan);
    $durations = [];
    foreach (range(1, 7) as $_) {
        $start = hrtime(true);
        $query->get();
        $durations[] = (hrtime(true) - $start) / 1e6;
    }
    sort($durations);
    m5cMeasurement('expiry_10010', ['fixture_rows' => 10010, 'eligible' => 10, 'tables' => $tables, 'median_ms_7' => round($durations[3], 3)]);
    // Actual rows read, not elapsed time or a hard-coded optimizer key: catch an accidental full scan.
    expect(array_sum(array_column($tables, 'r_rows')))->toBeLessThanOrEqual(20);
});

it('keeps matching notification fanout chunked and deduplicated for a larger audience', function () {
    $category = Category::factory()->create();
    $supplier = supplierUser(CompanyStatus::Approved, [$category->id => 'approved']);
    $rfq = Rfq::factory()->create(['category_id' => $category->id]);
    // One user belongs to one company; additional memberships share this approved supplier company.
    $passwordHash = $supplier->password;
    $users = [];
    foreach (range(1, 1200) as $i) {
        $users[] = ['name' => 'synthetic member', 'email' => "profile-{$i}@example.test", 'password' => $passwordHash, 'created_at' => now(), 'updated_at' => now()];
    }
    foreach (array_chunk($users, 400) as $chunk) {
        DB::table('users')->insert($chunk);
    }
    $ids = User::query()->where('email', 'like', 'profile-%@example.test')->pluck('id');
    $members = $ids->map(fn ($id) => ['user_id' => $id, 'company_id' => $supplier->company()->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()])->all();
    foreach (array_chunk($members, 400) as $chunk) {
        DB::table('company_members')->insert($chunk);
    }
    DB::flushQueryLog();
    DB::enableQueryLog();
    $start = hrtime(true);
    $inserted = DB::transaction(fn () => app(Notifier::class)->rfqMatched($rfq));
    $elapsed = (hrtime(true) - $start) / 1e6;
    $queries = DB::getQueryLog();
    DB::disableQueryLog();
    expect($inserted)->toBe(1201)->and(count($queries))->toBeLessThanOrEqual(6);
    expect(DB::transaction(fn () => app(Notifier::class)->rfqMatched($rfq)))->toBe(0);
    expect(DB::table('notifications')->count())->toBe(1201);
    m5cMeasurement('fanout_1201', ['recipients' => $inserted, 'queries' => count($queries), 'request_ms' => round($elapsed, 3)]);
});
