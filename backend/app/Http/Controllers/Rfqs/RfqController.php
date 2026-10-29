<?php

namespace App\Http\Controllers\Rfqs;

use App\Actions\Rfqs\CancelRfq;
use App\Actions\Rfqs\CloseRfq;
use App\Actions\Rfqs\CreateRfq;
use App\Http\Controllers\Controller;
use App\Http\Requests\Rfqs\StoreRfqRequest;
use App\Http\Resources\RfqResource;
use App\Models\Company;
use App\Models\Rfq;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;

/**
 * Buyer RFQs. Every action is authorized by RfqPolicy; lists are always scoped to the user's own company.
 */
class RfqController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Rfq::class);
        $request->validate(['page' => ['nullable', 'integer', 'min:1']]);

        $rfqs = Rfq::query()
            ->where('buyer_company_id', $this->company($request)->id)
            ->with(['category', 'area'])
            ->withCount(['attachments', 'quotes' => fn ($q) => $q->visibleToBuyer()])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(20);

        return RfqResource::collection($rfqs);
    }

    /**
     * Authorized in StoreRfqRequest::authorize() (before validation).
     */
    public function store(StoreRfqRequest $request, CreateRfq $action): JsonResponse
    {
        /** @var list<UploadedFile> $photos */
        $photos = array_values($request->file('photos', []));

        /** @var array{description: string, part_number?: string|null, machine_make?: string|null, machine_model?: string|null, quantity: int|string, unit: string, urgency: string, area_id: int|string} $data */
        $data = $request->safe()->except(['category', 'photos']);

        $rfq = $action->handle($this->user($request), $this->company($request), $data, $request->categoryId(), $photos);

        return (new RfqResource(self::forDetail($rfq)))->response()->setStatusCode(201);
    }

    public function show(Rfq $rfq): RfqResource
    {
        Gate::authorize('view', $rfq);

        return new RfqResource(self::forDetail($rfq));
    }

    public function cancel(Request $request, Rfq $rfq, CancelRfq $action): RfqResource
    {
        Gate::authorize('cancel', $rfq);

        return new RfqResource(self::forDetail($action->handle($rfq, $this->user($request))));
    }

    public function close(Request $request, Rfq $rfq, CloseRfq $action): RfqResource
    {
        Gate::authorize('close', $rfq);

        return new RfqResource(self::forDetail($action->handle($rfq, $this->user($request))));
    }

    /**
     * quotes_count = what the buyer can compare (submitted, supplier still approved).
     */
    public static function forDetail(Rfq $rfq): Rfq
    {
        return $rfq->load(['category', 'area', 'attachments'])->loadCount(['attachments', 'quotes' => fn ($q) => $q->visibleToBuyer()]);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    /**
     * Only called after the policy confirmed a buyer company exists.
     */
    private function company(Request $request): Company
    {
        /** @var Company $company */
        $company = $this->user($request)->company();

        return $company;
    }
}
