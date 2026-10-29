<?php

namespace App\Actions\Rfqs;

use App\Enums\NotificationKind;
use App\Enums\RfqStatus;
use App\Models\Quote;
use App\Models\Rfq;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Notifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The buyer chooses one quote: the RFQ is closed with selected_quote_id (ERD). Lock order RFQ → quote, the same
 * as SubmitQuote/WithdrawQuote, so a supplier editing or withdrawing at the same moment is serialised with this.
 * Re-checks everything under the locks; choosing the already chosen quote again is a no-op (double click).
 */
class SelectQuote
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly Notifier $notifier,
    ) {}

    /**
     * @param  string  $seenUpdatedAt  the quote's `updated_at` as the buyer saw it — proves they chose the current version
     */
    public function handle(Rfq $rfq, Quote $quote, User $buyer, string $seenUpdatedAt): Rfq
    {
        DB::transaction(function () use ($rfq, $quote, $buyer, $seenUpdatedAt) {
            /** @var Rfq $locked */
            $locked = Rfq::query()->whereKey($rfq->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->status === RfqStatus::Closed && $locked->selected_quote_id === $quote->id) {
                return; // same choice again: idempotent, nothing to record
            }
            if (! $locked->status->isClosable()) {
                abort(409, "لا يمكن اختيار عرض لطلب حالته «{$locked->status->label()}». حدّث الصفحة لترى الحالة الحالية.");
            }

            // Same RFQ (also guaranteed by the scoped route binding) and still visible to the buyer.
            /** @var Quote|null $current */
            $current = Quote::query()->whereKey($quote->id)->where('rfq_id', $locked->id)->visibleToBuyer()->lockForUpdate()->first();
            if ($current === null) {
                abort(409, 'لم يعد هذا العرض متاحاً (سحبه المورّد أو لم يعد المورّد مفعّلاً). حدّث الصفحة لترى العروض الحالية.');
            }
            if ($current->isPriceExpired()) {
                abort(409, 'انتهت صلاحية سعر هذا العرض. تواصل مع المورّد لتجديده، أو اختر عرضاً آخر.');
            }
            if (! $current->updated_at?->equalTo(Carbon::parse($seenUpdatedAt))) {
                abort(409, 'عدّل المورّد هذا العرض بعد أن فتحت الصفحة. راجع السعر الجديد ثم اختر من جديد.');
            }

            $from = $locked->status;
            $locked->forceFill(['status' => RfqStatus::Closed, 'selected_quote_id' => $current->id])->save();

            $this->audit->record('rfq.quote_selected', $locked, [
                'from' => $from->value,
                'quote_id' => $current->id,
                'supplier_company_id' => $current->supplier_company_id,
                'unit_price' => $current->unit_price,
                'currency' => $current->currency->value,
            ], $buyer);

            $this->notifier->toCompany($current->supplierCompany()->firstOrFail(), NotificationKind::QuoteSelected, "rfq:{$locked->id}:selected", Notifier::rfqData($locked));
        });

        return $rfq->refresh();
    }
}
