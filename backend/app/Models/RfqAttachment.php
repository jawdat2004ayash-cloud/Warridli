<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A re-encoded photo on the private disk (A5). Served only by RfqAttachmentController after RfqPolicy::view.
 */
class RfqAttachment extends Model
{
    public const UPDATED_AT = null;

    /**
     * @return BelongsTo<Rfq, $this>
     */
    public function rfq(): BelongsTo
    {
        return $this->belongsTo(Rfq::class);
    }
}
