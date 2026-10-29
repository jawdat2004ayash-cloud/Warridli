<?php

namespace App\Http\Resources;

use App\Models\Rfq;
use App\Models\RfqAttachment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The buyer's view of their own RFQ. Explicit allow-list: no internal ids of companies/users, no file paths.
 * List: expects category + area loaded and attachments counted. Detail: attachments loaded too.
 *
 * @mixin Rfq
 */
class RfqResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->ulid,
            'status' => $this->status->value,
            // false once closes_at passed even before the scheduler marks it expired (D34).
            'accepts_quotes' => $this->acceptsQuotes(),
            'selected_quote_id' => $this->selected_quote_id,
            'category' => $this->category === null ? null : new CategoryResource($this->category),
            'description' => $this->description,
            'part_number' => $this->part_number,
            'machine_make' => $this->machine_make,
            'machine_model' => $this->machine_model,
            'quantity' => $this->quantity,
            'unit' => $this->unit->value,
            'urgency' => $this->urgency->value,
            'area' => new AreaResource($this->area),
            'closes_at' => $this->closes_at->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'photos_count' => $this->whenCounted('attachments'),
            // Quotes the buyer can compare (GET /api/rfqs/{id}/quotes).
            'quotes_count' => $this->whenCounted('quotes'),
            'photos' => $this->whenLoaded('attachments', fn () => $this->attachments->map(fn (RfqAttachment $photo) => [
                'id' => $photo->id,
                'url' => "/api/rfqs/{$this->ulid}/photos/{$photo->id}",
                'width' => $photo->width,
                'height' => $photo->height,
            ])->values()->all()),
        ];
    }
}
