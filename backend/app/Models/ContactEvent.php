<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Append-only log of revealed supplier contacts. Written only by App\Actions\Rfqs\RevealSupplierContact.
 */
class ContactEvent extends Model
{
    public const UPDATED_AT = null;
}
