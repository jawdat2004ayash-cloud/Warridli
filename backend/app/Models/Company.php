<?php

namespace App\Models;

use App\Enums\CompanyStatus;
use App\Enums\CompanyType;
use Database\Factories\CompanyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * status / verified_by / verified_at are not fillable: only App\Actions\Admin\TransitionCompanyStatus changes them.
 * verified_by / verified_at = the admin who last approved or rejected the company (review decision).
 *
 * @property CompanyType $type
 * @property CompanyStatus $status
 * @property Carbon|null $verified_at
 */
#[Fillable(['type', 'name', 'whatsapp_phone', 'area_id', 'address_text'])]
class Company extends Model
{
    /** @use HasFactory<CompanyFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => CompanyType::class,
            'status' => CompanyStatus::class,
            'verified_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Area, $this>
     */
    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    /**
     * @return HasMany<CompanyMember, $this>
     */
    public function members(): HasMany
    {
        return $this->hasMany(CompanyMember::class);
    }

    /**
     * Supplier specialties (pending or approved).
     *
     * @return HasMany<SupplierCategory, $this>
     */
    public function supplierCategories(): HasMany
    {
        return $this->hasMany(SupplierCategory::class)->orderBy('category_id');
    }
}
