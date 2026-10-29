<?php

namespace App\Actions\Rfqs;

use App\Enums\RfqStatus;
use App\Models\Rfq;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * Buyer cancels their own request while it is still pending review or open. Row-locked, audited.
 */
class CancelRfq
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(Rfq $rfq, User $user): Rfq
    {
        DB::transaction(function () use ($rfq, $user) {
            /** @var Rfq $locked */
            $locked = Rfq::query()->whereKey($rfq->getKey())->lockForUpdate()->firstOrFail();
            $from = $locked->status;

            if (! $from->isCancellable()) {
                abort(409, "لا يمكن إلغاء طلب حالته «{$from->label()}». حدّث الصفحة لترى الحالة الحالية.");
            }

            $locked->forceFill(['status' => RfqStatus::Cancelled])->save();
            $this->audit->record('rfq.cancelled', $locked, ['from' => $from->value], $user);
        });

        return $rfq->refresh();
    }
}
