<?php

namespace App\Actions\Rfqs;

use App\Enums\RfqStatus;
use App\Models\Rfq;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * The buyer is done without choosing a quote here (found the part elsewhere, no suitable offer). Row-locked, audited.
 */
class CloseRfq
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(Rfq $rfq, User $buyer): Rfq
    {
        DB::transaction(function () use ($rfq, $buyer) {
            /** @var Rfq $locked */
            $locked = Rfq::query()->whereKey($rfq->getKey())->lockForUpdate()->firstOrFail();
            $from = $locked->status;

            if (! $from->isClosable()) {
                abort(409, "لا يمكن إغلاق طلب حالته «{$from->label()}». حدّث الصفحة لترى الحالة الحالية.");
            }

            $locked->forceFill(['status' => RfqStatus::Closed])->save();
            $this->audit->record('rfq.closed', $locked, ['from' => $from->value], $buyer);
        });

        return $rfq->refresh();
    }
}
