<?php

namespace App\Models;

use App\Enums\RfqStatus;
use App\Enums\RfqUnit;
use App\Enums\RfqUrgency;
use App\Enums\SupplierCategoryStatus;
use Database\Factories\RfqFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A buyer's request for quotation for one part (D1). Nothing is mass-assignable: only
 * App\Actions\Rfqs\* write RFQs. Public identifier is the ULID (A7); authorization is RfqPolicy.
 *
 * @property RfqStatus $status
 * @property RfqUnit $unit
 * @property RfqUrgency $urgency
 * @property Carbon $closes_at
 * @property Carbon|null $triaged_at
 */
class Rfq extends Model
{
    /** @use HasFactory<RfqFactory> */
    use HasFactory, HasUlids;

    /**
     * Mirror the DB default so a just-created RFQ is complete (strict mode).
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'selected_quote_id' => null,
        'triaged_by' => null,
        'triaged_at' => null,
    ];

    /**
     * Only the `ulid` column is generated; the primary key stays an auto-increment integer.
     *
     * @return list<string>
     */
    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => RfqStatus::class,
            'unit' => RfqUnit::class,
            'urgency' => RfqUrgency::class,
            'closes_at' => 'datetime',
            'triaged_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function buyerCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'buyer_company_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * @return BelongsTo<Area, $this>
     */
    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    /**
     * @return HasMany<RfqAttachment, $this>
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(RfqAttachment::class)->orderBy('id');
    }

    /**
     * @return HasMany<Quote, $this>
     */
    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class);
    }

    public function acceptsQuotes(): bool
    {
        return $this->status === RfqStatus::Open && $this->closes_at->isFuture();
    }

    /**
     * Targeting (D10, D30) — the single definition used by the inbox, the policy and the quote action:
     * open, not past closes_at, and in a category the supplier is APPROVED for. Area is not a filter.
     * pending_review RFQs have no category and can never match.
     *
     * @param  Builder<Rfq>  $query
     * @return Builder<Rfq>
     */
    public function scopeQuotableBy(Builder $query, Company $supplier): Builder
    {
        return $query
            ->where('rfqs.status', RfqStatus::Open)
            ->where('rfqs.closes_at', '>', now())
            ->whereIn('rfqs.category_id', SupplierCategory::query()
                ->select('category_id')
                ->where('company_id', $supplier->id)
                ->where('status', SupplierCategoryStatus::Approved));
    }

    /**
     * What a supplier may see: everything quotable, plus any RFQ it already quoted on (so it can still read
     * its own quote after the RFQ was cancelled or its category approval was removed).
     *
     * @param  Builder<Rfq>  $query
     * @return Builder<Rfq>
     */
    public function scopeVisibleToSupplier(Builder $query, Company $supplier): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->where(fn (Builder $eligible) => $eligible->quotableBy($supplier))
            ->orWhereExists(fn ($own) => $own->selectRaw('1')->from('quotes')
                ->whereColumn('quotes.rfq_id', 'rfqs.id')
                ->where('quotes.supplier_company_id', $supplier->id)));
    }
}
