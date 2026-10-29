<?php

namespace App\Http\Controllers\Supplier;

use App\Http\Controllers\Controller;
use App\Http\Resources\SupplierRfqResource;
use App\Models\Company;
use App\Models\Rfq;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Supplier inbox. Route group middleware `supplier` = approved supplier company; per-RFQ visibility is
 * Rfq::visibleToSupplier() via RfqPolicy (everything else is a 404).
 */
class SupplierRfqController extends Controller
{
    /**
     * tab=new: RFQs it can quote on and hasn't yet (most urgent need first: newest).
     * tab=quoted: RFQs it has a quote on (submitted or withdrawn), whatever their status now.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'tab' => ['nullable', Rule::in(['new', 'quoted'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $company = self::supplier($request);
        $own = fn ($q) => $q->selectRaw('1')->from('quotes')
            ->whereColumn('quotes.rfq_id', 'rfqs.id')
            ->where('quotes.supplier_company_id', $company->id);

        $query = $request->input('tab') === 'quoted'
            ? Rfq::query()->whereExists($own)
            : Rfq::query()->where(fn (Builder $q) => $q->quotableBy($company))->whereNotExists($own);

        $rfqs = SupplierRfqResource::withRelations($query, $company)
            ->orderByDesc('rfqs.created_at')
            ->orderByDesc('rfqs.id')
            ->paginate(20)
            ->withQueryString();

        return SupplierRfqResource::collection($rfqs);
    }

    public function show(Request $request, Rfq $rfq): SupplierRfqResource
    {
        Gate::authorize('viewAsSupplier', $rfq);

        return self::detail($rfq, self::supplier($request));
    }

    public static function detail(Rfq $rfq, Company $supplier): SupplierRfqResource
    {
        return new SupplierRfqResource($rfq->load([...SupplierRfqResource::relations($supplier), 'attachments'])->loadCount('attachments'));
    }

    /**
     * Guaranteed by the `supplier` middleware.
     */
    public static function supplier(Request $request): Company
    {
        /** @var User $user */
        $user = $request->user();
        /** @var Company $company */
        $company = $user->company();

        return $company;
    }
}
