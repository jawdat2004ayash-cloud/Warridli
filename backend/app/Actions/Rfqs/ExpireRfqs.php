<?php

namespace App\Actions\Rfqs;

use App\Enums\RfqStatus;
use App\Models\Rfq;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * Scheduled (routes/console.php): open RFQs past closes_at become `expired` — no new quotes, but the buyer can
 * still choose among the received ones (D34). Conditional UPDATE … WHERE status = open, so a buyer closing at
 * the same moment wins cleanly and a run can be repeated safely. pending_review is left to admin triage (M4a).
 */
class ExpireRfqs
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @return int number of RFQs expired by this run
     */
    public function handle(): int
    {
        $expired = 0;

        Rfq::query()
            ->where('status', RfqStatus::Open)
            ->where('closes_at', '<=', now())
            ->select(['id', 'closes_at'])
            ->chunkById(200, function ($rfqs) use (&$expired) {
                foreach ($rfqs as $rfq) {
                    $expired += DB::transaction(function () use ($rfq): int {
                        $changed = Rfq::query()->whereKey($rfq->id)->where('status', RfqStatus::Open)
                            ->update(['status' => RfqStatus::Expired, 'updated_at' => now()]);
                        if ($changed === 1) {
                            $this->audit->record('rfq.expired', $rfq, ['closes_at' => $rfq->closes_at->toIso8601String()]);
                        }

                        return $changed;
                    });
                }
            });

        return $expired;
    }
}
