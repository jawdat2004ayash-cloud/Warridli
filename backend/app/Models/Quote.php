<?php

namespace App\Models;

use App\Enums\CompanyStatus;
use App\Enums\Currency;
use App\Enums\Fulfillment;
use App\Enums\QuoteCondition;
use App\Enums\QuoteStatus;
use App\Enums\StockStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A supplier company's private price for one RFQ (unique per RFQ + company). Nothing is mass-assignable:
 * only App\Actions\Quotes\* write quotes. Never shown to other suppliers.
 *
 * @property string $unit_price decimal as string, e.g. "1250000.00"
 * @property Currency $currency
 * @property QuoteCondition $condition
 * @property StockStatus $stock_status
 * @property Fulfillment $fulfillment
 * @property QuoteStatus $status
 * @property Carbon $valid_until
 */
class Quote extends Model
{
    /** Preserve the version that the buyer saw, including changes made within one second. */
    protected $dateFormat = 'Y-m-d H:i:s.u';

    /** @return $this */
    public function updateTimestamps()
    {
        $previous = $this->exists ? $this->updated_at : null;
        $explicit = $this->isDirty($this->getUpdatedAtColumn());
        parent::updateTimestamps();

        // Quote writes are serialized by the existing RFQ lock. A frozen/backward clock must not reuse
        // a stored version; explicit trusted timestamps (e.g. imports/tests) retain their meaning.
        if ($previous !== null && ! $explicit && $this->updated_at->lessThanOrEqualTo($previous)) {
            $this->setUpdatedAt($previous->copy()->addMicrosecond());
        }

        return $this;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'currency' => Currency::class,
            'condition' => QuoteCondition::class,
            'stock_status' => StockStatus::class,
            'fulfillment' => Fulfillment::class,
            'status' => QuoteStatus::class,
            'valid_until' => 'date',
        ];
    }

    /**
     * Quotes the buyer sees and may choose or contact: submitted (not withdrawn) by a supplier company that is
     * still approved (a suspended supplier's quotes disappear from comparison, D33).
     *
     * @param  Builder<Quote>  $query
     * @return Builder<Quote>
     */
    public function scopeVisibleToBuyer(Builder $query): Builder
    {
        return $query->where('quotes.status', QuoteStatus::Submitted)
            ->whereHas('supplierCompany', fn (Builder $company) => $company->where('status', CompanyStatus::Approved));
    }

    /**
     * The supplier's price is no longer valid (valid_until before today in Damascus, D6b): it can be read and
     * the supplier contacted to renew it, but not chosen.
     */
    public function isPriceExpired(): bool
    {
        return $this->valid_until->toDateString() < now('Asia/Damascus')->toDateString();
    }

    /**
     * @return BelongsTo<Rfq, $this>
     */
    public function rfq(): BelongsTo
    {
        return $this->belongsTo(Rfq::class);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function supplierCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'supplier_company_id');
    }
}
