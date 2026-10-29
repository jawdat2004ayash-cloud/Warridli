<?php

namespace App\Http\Resources;

use App\Models\Quote;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A supplier's OWN quote. Explicit allow-list; money stays a decimal string ("125000.50") — never a float.
 *
 * @mixin Quote
 */
class QuoteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'status' => $this->status->value,
            'unit_price' => $this->unit_price,
            'currency' => $this->currency->value,
            'condition' => $this->condition->value,
            'brand' => $this->brand,
            'origin' => $this->origin,
            'stock_status' => $this->stock_status->value,
            'lead_time_days' => $this->lead_time_days,
            'fulfillment' => $this->fulfillment->value,
            'valid_until' => $this->valid_until->toDateString(),
            'notes' => $this->notes,
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
