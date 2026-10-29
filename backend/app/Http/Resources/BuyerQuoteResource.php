<?php

namespace App\Http\Resources;

use App\Models\Quote;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A quote as the RFQ's buyer compares it. The supplier is named (approved, vetted company) with its area,
 * but its phone is NOT here: it is revealed only through the logged contact endpoint (D33).
 * Expects supplierCompany.area loaded and `selected_quote_id` passed from the RFQ.
 *
 * @mixin Quote
 */
class BuyerQuoteResource extends JsonResource
{
    public function __construct(Quote $quote, private readonly ?int $selectedQuoteId)
    {
        parent::__construct($quote);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'supplier' => [
                'name' => $this->supplierCompany->name,
                'area' => new AreaResource($this->supplierCompany->area),
            ],
            'unit_price' => $this->unit_price,
            'currency' => $this->currency->value,
            'condition' => $this->condition->value,
            'brand' => $this->brand,
            'origin' => $this->origin,
            'stock_status' => $this->stock_status->value,
            'lead_time_days' => $this->lead_time_days,
            'fulfillment' => $this->fulfillment->value,
            'valid_until' => $this->valid_until->toDateString(),
            'price_expired' => $this->isPriceExpired(),
            'notes' => $this->notes,
            'updated_at' => $this->updated_at?->toISOString(),
            'selected' => $this->id === $this->selectedQuoteId,
        ];
    }
}
