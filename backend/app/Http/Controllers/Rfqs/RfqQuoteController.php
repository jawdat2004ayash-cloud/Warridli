<?php

namespace App\Http\Controllers\Rfqs;

use App\Actions\Rfqs\RevealSupplierContact;
use App\Actions\Rfqs\SelectQuote;
use App\Http\Controllers\Controller;
use App\Http\Resources\BuyerQuoteResource;
use App\Http\Resources\RfqResource;
use App\Models\Quote;
use App\Models\Rfq;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * The buyer's view of the quotes on their own RFQ (M3c). Every action first checks RfqPolicy::view
 * (someone else's RFQ → 404); {quote} is scope-bound to {rfq}, so a quote of another RFQ is a 404 too.
 */
class RfqQuoteController extends Controller
{
    /**
     * All visible quotes, cheapest first per currency (the UI can re-sort). Bounded by the number of approved
     * suppliers in one category, so not paginated (like categories/areas).
     */
    public function index(Rfq $rfq): JsonResponse
    {
        Gate::authorize('view', $rfq);

        $quotes = $rfq->quotes()->visibleToBuyer()
            ->with('supplierCompany.area')
            ->orderBy('currency')
            ->orderBy('unit_price')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $quotes->map(fn (Quote $quote) => (new BuyerQuoteResource($quote, $rfq->selected_quote_id))->resolve())->values()->all(),
        ]);
    }

    public function select(Request $request, Rfq $rfq, Quote $quote, SelectQuote $action): RfqResource
    {
        Gate::authorize('view', $rfq);
        $data = $request->validate(['seen_updated_at' => ['required', 'string', 'date']], [
            'seen_updated_at.required' => 'حدّث الصفحة ثم اختر العرض من جديد.',
            'seen_updated_at.date' => 'حدّث الصفحة ثم اختر العرض من جديد.',
        ]);

        $rfq = $action->handle($rfq, $quote, $this->user($request), $data['seen_updated_at']);

        return new RfqResource(RfqController::forDetail($rfq));
    }

    public function contact(Request $request, Rfq $rfq, Quote $quote, RevealSupplierContact $action): JsonResponse
    {
        Gate::authorize('view', $rfq);

        return response()->json(['data' => $action->handle($rfq, $quote, $this->user($request))]);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
