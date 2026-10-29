<?php

namespace App\Http\Resources;

use App\Models\Company;
use App\Models\Quote;
use App\Models\Rfq;
use App\Models\RfqAttachment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An RFQ as a supplier sees it (D4): the part, quantity, urgency, area and photos — never the buyer's company,
 * name, phone or user, and never another supplier's quote. `my_quote` is the supplier's own quote or null.
 * Load with SupplierRfqResource::relations($supplier) so `quotes` holds ONLY this supplier's quote.
 *
 * @mixin Rfq
 */
class SupplierRfqResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Quote|null $mine */
        $mine = $this->quotes->first();

        return [
            'id' => $this->ulid,
            'status' => $this->status->value,
            'accepts_quotes' => $this->acceptsQuotes(),
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
            'photos' => $this->whenLoaded('attachments', fn () => $this->attachments->map(fn (RfqAttachment $photo) => [
                'id' => $photo->id,
                'url' => "/api/supplier/rfqs/{$this->ulid}/photos/{$photo->id}",
                'width' => $photo->width,
                'height' => $photo->height,
            ])->values()->all()),
            // `selected`: the buyer chose this supplier's quote — the only outcome a supplier learns (no competitor data).
            'my_quote' => $mine === null ? null : [...(new QuoteResource($mine))->resolve(), 'selected' => $this->selected_quote_id === $mine->id],
        ];
    }

    /**
     * Eager loads for list and detail. The quotes constraint is what keeps competitors' quotes out.
     *
     * @return array<string|int, mixed>
     */
    public static function relations(Company $supplier): array
    {
        return [
            'category',
            'area',
            'quotes' => fn ($query) => $query->where('supplier_company_id', $supplier->id),
        ];
    }

    /**
     * @param  Builder<Rfq>  $query
     * @return Builder<Rfq>
     */
    public static function withRelations(Builder $query, Company $supplier): Builder
    {
        return $query->with(self::relations($supplier))->withCount('attachments');
    }
}
