<?php

namespace App\Actions\Quotes;

use App\Enums\NotificationKind;
use App\Enums\QuoteStatus;
use App\Enums\StockStatus;
use App\Models\Company;
use App\Models\Quote;
use App\Models\Rfq;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Notifier;
use Illuminate\Support\Facades\DB;

/**
 * Create, edit or re-submit (after withdrawing) the supplier company's single quote on an RFQ (D11).
 * The RFQ row is locked, so this serialises with a buyer cancelling and with a colleague submitting at the
 * same moment; the unique (rfq_id, supplier_company_id) index is the last line of defence against duplicates.
 */
class SubmitQuote
{
    /** Fields whose change is recorded in the audit log (names only for free text). */
    private const TRACKED = ['unit_price', 'currency', 'condition', 'brand', 'origin', 'stock_status', 'lead_time_days', 'fulfillment', 'valid_until', 'notes'];

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly Notifier $notifier,
    ) {}

    /**
     * @param  array{unit_price: string|int|float, currency: string, condition: string, brand?: string|null, origin?: string|null, stock_status: string, lead_time_days?: int|string|null, fulfillment: string, valid_until: string, notes?: string|null}  $data
     */
    public function handle(Rfq $rfq, Company $supplier, User $user, array $data): Quote
    {
        return DB::transaction(function () use ($rfq, $supplier, $user, $data) {
            /** @var Rfq $locked */
            $locked = Rfq::query()->whereKey($rfq->getKey())->lockForUpdate()->firstOrFail();
            self::ensureQuotable($locked, $supplier);

            $quote = Quote::query()->where('rfq_id', $locked->id)->where('supplier_company_id', $supplier->id)->first() ?? new Quote;
            $before = $quote->exists ? $quote->status : null;

            $stock = StockStatus::from($data['stock_status']);
            $quote->forceFill([
                'rfq_id' => $locked->id,
                'supplier_company_id' => $supplier->id,
                'submitted_by' => $user->id,
                'unit_price' => (string) $data['unit_price'],
                'currency' => $data['currency'],
                'condition' => $data['condition'],
                'brand' => $data['brand'] ?? null,
                'origin' => $data['origin'] ?? null,
                'stock_status' => $stock,
                // Available now = no waiting time, whatever the form sent.
                'lead_time_days' => $stock === StockStatus::InStock ? 0 : (int) ($data['lead_time_days'] ?? 0),
                'fulfillment' => $data['fulfillment'],
                'valid_until' => $data['valid_until'],
                'notes' => $data['notes'] ?? null,
                'status' => QuoteStatus::Submitted,
            ]);

            $changed = array_values(array_intersect(self::TRACKED, array_keys($quote->getDirty())));
            $quote->save();

            $action = match ($before) {
                null => 'quote.submitted',
                QuoteStatus::Withdrawn => 'quote.resubmitted',
                QuoteStatus::Submitted => 'quote.updated',
            };
            $this->audit->record($action, $quote, [
                'rfq_id' => $locked->id,
                'unit_price' => $quote->unit_price,
                'currency' => $quote->currency->value,
                'changed' => $before === null ? null : implode(',', $changed),
            ], $user);

            if ($before === null) {
                $this->notifier->toCompany($locked->buyerCompany()->firstOrFail(), NotificationKind::QuoteReceived, "quote:{$quote->id}:received", Notifier::rfqData($locked));
            }

            return $quote;
        });
    }

    /**
     * Re-checked under the lock: the RFQ may have been cancelled, have expired, or the supplier's category
     * approval may have been removed since the page was loaded.
     */
    public static function ensureQuotable(Rfq $locked, Company $supplier): void
    {
        if (! $locked->acceptsQuotes()) {
            abort(409, 'هذا الطلب لم يعد يستقبل عروضاً (أُلغي أو أُغلق أو انتهت مدته).');
        }

        if (! Rfq::query()->whereKey($locked->id)->quotableBy($supplier)->exists()) {
            abort(409, 'لم يعد تصنيف هذا الطلب ضمن تخصصاتك المعتمدة، لذلك لا يمكنك تقديم عرض عليه.');
        }
    }
}
