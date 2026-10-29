<?php

namespace App\Actions\Quotes;

use App\Enums\QuoteStatus;
use App\Models\Company;
use App\Models\Quote;
use App\Models\Rfq;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * The supplier withdraws its own quote while the RFQ still accepts quotes (D11). Kept as a row
 * (status withdrawn) so the history stays auditable and the supplier can re-submit.
 */
class WithdrawQuote
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(Rfq $rfq, Company $supplier, User $user): Quote
    {
        return DB::transaction(function () use ($rfq, $supplier, $user) {
            /** @var Rfq $locked */
            $locked = Rfq::query()->whereKey($rfq->getKey())->lockForUpdate()->firstOrFail();

            $quote = Quote::query()->where('rfq_id', $locked->id)->where('supplier_company_id', $supplier->id)->first();
            if ($quote === null || $quote->status !== QuoteStatus::Submitted) {
                abort(409, 'لا يوجد عرض فعّال لك على هذا الطلب لسحبه.');
            }

            SubmitQuote::ensureQuotable($locked, $supplier);

            $quote->forceFill(['status' => QuoteStatus::Withdrawn])->save();
            $this->audit->record('quote.withdrawn', $quote, ['rfq_id' => $locked->id], $user);

            return $quote;
        });
    }
}
