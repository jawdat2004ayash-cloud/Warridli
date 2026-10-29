<?php

namespace App\Services;

use App\Enums\CompanyStatus;
use App\Enums\CompanyType;
use App\Enums\RfqStatus;
use App\Enums\SupplierCategoryStatus;
use App\Models\Company;
use App\Models\Rfq;
use App\Models\SupplierCategory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Admin metrics (D12): requests, share that received a quote, time to first quote, contact reveals — plus the
 * work waiting for an admin. Definitions are documented in docs/API.md and shown in the panel (D37).
 * Period = RFQs CREATED in the last N days (null = all). Medians are computed in PHP over one row per quoted RFQ
 * of the period — fine at MVP volume; revisit with measurements if periods grow to many thousands of RFQs.
 */
class OperationalMetrics
{
    /**
     * @return array<string, mixed>
     */
    public function compute(?int $days): array
    {
        $since = $days === null ? null : now()->subDays($days);
        $inPeriod = fn (Builder|QueryBuilder $query) => $since === null ? $query : $query->where('rfqs.created_at', '>=', $since);

        /** @var array<string, int> $byStatus */
        $byStatus = $inPeriod(Rfq::query())
            ->selectRaw('status, count(*) as aggregate')->groupBy('status')
            ->pluck('aggregate', 'status')->map(fn ($n) => (int) $n)->all();

        // Reached suppliers = has a category (chosen by the buyer, or set in triage). Rejected / still pending never did.
        $published = $inPeriod(Rfq::query())->whereNotNull('category_id')->count();
        // Any quote row counts, also one withdrawn later: the request did get an answer.
        $quoted = $inPeriod(Rfq::query())->whereExists(fn ($q) => $q->selectRaw('1')->from('quotes')->whereColumn('quotes.rfq_id', 'rfqs.id'))->count();

        $firstQuoteMinutes = $inPeriod(Rfq::query()->toBase()
            ->joinSub(DB::table('quotes')->selectRaw('rfq_id, min(created_at) as first_at')->groupBy('rfq_id'), 'fq', 'fq.rfq_id', '=', 'rfqs.id'))
            ->selectRaw('TIMESTAMPDIFF(SECOND, rfqs.created_at, fq.first_at) as seconds')
            ->pluck('seconds')->map(fn ($s) => max(0, (int) $s) / 60)->all();

        $triageMinutes = $inPeriod(Rfq::query()->toBase())
            ->whereNotNull('triaged_at')
            ->selectRaw('TIMESTAMPDIFF(SECOND, created_at, triaged_at) as seconds')
            ->pluck('seconds')->map(fn ($s) => max(0, (int) $s) / 60)->all();

        $contacts = DB::table('contact_events')->when($since !== null, fn ($q) => $q->where('created_at', '>=', $since));

        return [
            'period_days' => $days,
            'since' => $since?->toIso8601String(),
            'generated_at' => Carbon::now()->toIso8601String(),
            'rfqs' => [
                'created' => array_sum($byStatus),
                'by_status' => array_merge(array_fill_keys(array_column(RfqStatus::cases(), 'value'), 0), $byStatus),
                'published' => $published,
                'with_quote' => $quoted,
                'with_quote_rate' => $published === 0 ? null : round($quoted / $published, 4),
                'with_selection' => $inPeriod(Rfq::query())->whereNotNull('selected_quote_id')->count(),
            ],
            'first_quote' => [
                'sample' => count($firstQuoteMinutes),
                'median_minutes' => self::median($firstQuoteMinutes),
            ],
            'triage' => [
                'sample' => count($triageMinutes),
                'median_minutes' => self::median($triageMinutes),
            ],
            'contacts' => [
                'reveals' => (clone $contacts)->count(),
                'rfqs' => (clone $contacts)->distinct()->count('rfq_id'),
            ],
            // Work waiting now, independent of the period.
            'queue' => [
                'suppliers_pending' => Company::query()->where('type', CompanyType::Supplier)->where('status', CompanyStatus::Pending)->count(),
                'specialties_pending' => SupplierCategory::query()->where('status', SupplierCategoryStatus::Pending)->count(),
                'rfqs_pending_review' => Rfq::query()->where('status', RfqStatus::PendingReview)->count(),
            ],
        ];
    }

    /**
     * @param  list<float|int>  $values
     */
    private static function median(array $values): ?float
    {
        if ($values === []) {
            return null;
        }
        sort($values);
        $count = count($values);
        $middle = intdiv($count, 2);
        $median = $count % 2 === 1 ? $values[$middle] : ($values[$middle - 1] + $values[$middle]) / 2;

        return round((float) $median, 1);
    }
}
