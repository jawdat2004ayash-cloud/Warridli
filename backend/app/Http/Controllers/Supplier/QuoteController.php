<?php

namespace App\Http\Controllers\Supplier;

use App\Actions\Quotes\SubmitQuote;
use App\Actions\Quotes\WithdrawQuote;
use App\Http\Controllers\Controller;
use App\Http\Requests\Quotes\UpsertQuoteRequest;
use App\Http\Resources\SupplierRfqResource;
use App\Models\Rfq;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * The supplier's own quote on one RFQ (one per company, D11). Responds with the RFQ as the supplier sees it.
 */
class QuoteController extends Controller
{
    /**
     * Authorized in UpsertQuoteRequest::authorize() (before validation).
     */
    public function upsert(UpsertQuoteRequest $request, Rfq $rfq, SubmitQuote $action): SupplierRfqResource
    {
        $supplier = SupplierRfqController::supplier($request);

        /** @var array{unit_price: string|int|float, currency: string, condition: string, brand?: string|null, origin?: string|null, stock_status: string, lead_time_days?: int|string|null, fulfillment: string, valid_until: string, notes?: string|null} $data */
        $data = $request->validated();
        $action->handle($rfq, $supplier, $this->user($request), $data);

        return SupplierRfqController::detail($rfq, $supplier);
    }

    public function withdraw(Request $request, Rfq $rfq, WithdrawQuote $action): SupplierRfqResource
    {
        Gate::authorize('quote', $rfq);
        $supplier = SupplierRfqController::supplier($request);

        $action->handle($rfq, $supplier, $this->user($request));

        return SupplierRfqController::detail($rfq, $supplier);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
