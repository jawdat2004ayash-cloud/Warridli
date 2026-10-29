<?php

namespace App\Services;

use App\Enums\CompanyStatus;
use App\Enums\CompanyType;
use App\Enums\NotificationKind;
use App\Enums\SupplierCategoryStatus;
use App\Models\Company;
use App\Models\Rfq;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Writes in-app notifications (D39). Called inside the action's transaction, so a notification exists only if
 * the decision was committed. One bulk INSERT IGNORE per event: no N+1, and the unique
 * (recipient, dedupe_key) index makes a retried or concurrent event harmless. Suspended users are skipped.
 * $data must only hold what the recipient may already see (no prices, phones or other companies' details).
 */
class Notifier
{
    private const CHUNK = 500;

    /**
     * @param  list<int>  $userIds
     * @param  array<string, scalar|null>  $data
     */
    public function toUsers(array $userIds, NotificationKind $kind, string $dedupeKey, array $data): int
    {
        $userIds = array_values(array_unique($userIds));
        if ($userIds === []) {
            return 0;
        }

        $now = now()->format('Y-m-d H:i:s.u'); // keep microseconds (a Carbon binding would drop them)
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $inserted = 0;

        foreach (array_chunk($userIds, self::CHUNK) as $chunk) {
            $rows = array_map(fn (int $userId) => [
                'id' => (string) Str::uuid(),
                'type' => $kind->value,
                'notifiable_type' => 'user',
                'notifiable_id' => $userId,
                'dedupe_key' => $dedupeKey,
                'data' => $json,
                'created_at' => $now,
                'updated_at' => $now,
            ], $chunk);
            $inserted += DB::table('notifications')->insertOrIgnore($rows);
        }

        return $inserted;
    }

    /**
     * @param  array<string, scalar|null>  $data
     */
    public function toCompany(Company $company, NotificationKind $kind, string $dedupeKey, array $data): int
    {
        return $this->toUsers($this->activeMemberIds([$company->id]), $kind, $dedupeKey, $data);
    }

    /**
     * Every active member of every approved supplier company APPROVED for the RFQ's category — the same audience
     * as Rfq::quotableBy (D30), resolved in one query.
     */
    public function rfqMatched(Rfq $rfq): int
    {
        if ($rfq->category_id === null) {
            return 0;
        }

        $companyIds = DB::table('supplier_categories')
            ->join('companies', 'companies.id', '=', 'supplier_categories.company_id')
            ->where('supplier_categories.category_id', $rfq->category_id)
            ->where('supplier_categories.status', SupplierCategoryStatus::Approved->value)
            ->where('companies.type', CompanyType::Supplier->value)
            ->where('companies.status', CompanyStatus::Approved->value)
            ->pluck('companies.id')->map(fn ($id) => (int) $id)->all();

        return $this->toUsers($this->activeMemberIds($companyIds), NotificationKind::RfqMatched, "rfq:{$rfq->id}:matched", self::rfqData($rfq));
    }

    /**
     * What a notification about an RFQ may carry: its public id, a short description and the category name —
     * all things every recipient can already read on the RFQ page.
     *
     * @return array<string, scalar|null>
     */
    public static function rfqData(Rfq $rfq): array
    {
        return [
            'rfq_id' => $rfq->ulid,
            'description' => Str::limit($rfq->description, 80),
            'category' => $rfq->category_id === null ? null : DB::table('categories')->where('id', $rfq->category_id)->value('name_ar'),
        ];
    }

    /**
     * @param  list<int>  $companyIds
     * @return list<int>
     */
    private function activeMemberIds(array $companyIds): array
    {
        if ($companyIds === []) {
            return [];
        }

        return DB::table('company_members')
            ->join('users', 'users.id', '=', 'company_members.user_id')
            ->whereIn('company_members.company_id', $companyIds)
            ->whereNull('users.suspended_at')
            ->pluck('users.id')->map(fn ($id) => (int) $id)->values()->all();
    }
}
