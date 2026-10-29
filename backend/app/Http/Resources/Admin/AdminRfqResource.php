<?php

namespace App\Http\Resources\Admin;

use App\Http\Resources\AreaResource;
use App\Http\Resources\CategoryResource;
use App\Models\Rfq;
use App\Models\RfqAttachment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An RFQ as the admin triages it. Includes the buyer company (the admin may need to call it to clarify the part)
 * but never quotes, prices or supplier data — triage doesn't need them. Photos only through the admin route.
 * Expects category, area, buyerCompany loaded and attachments counted; detail: attachments loaded too.
 *
 * @mixin Rfq
 */
class AdminRfqResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->ulid,
            'status' => $this->status->value,
            'category' => $this->category === null ? null : new CategoryResource($this->category),
            'description' => $this->description,
            'part_number' => $this->part_number,
            'machine_make' => $this->machine_make,
            'machine_model' => $this->machine_model,
            'quantity' => $this->quantity,
            'unit' => $this->unit->value,
            'urgency' => $this->urgency->value,
            'area' => new AreaResource($this->area),
            'buyer' => [
                'company_id' => $this->buyerCompany->id,
                'name' => $this->buyerCompany->name,
                'whatsapp_phone' => $this->buyerCompany->whatsapp_phone,
            ],
            'closes_at' => $this->closes_at->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'triaged_at' => $this->triaged_at?->toIso8601String(),
            'photos_count' => $this->whenCounted('attachments'),
            'photos' => $this->whenLoaded('attachments', fn () => $this->attachments->map(fn (RfqAttachment $photo) => [
                'id' => $photo->id,
                'url' => "/api/admin/rfqs/{$this->ulid}/photos/{$photo->id}",
                'width' => $photo->width,
                'height' => $photo->height,
            ])->values()->all()),
        ];
    }

    /**
     * @return list<string>
     */
    public static function relations(): array
    {
        return ['category', 'area', 'buyerCompany'];
    }
}
