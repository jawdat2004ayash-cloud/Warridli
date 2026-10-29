<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\TriageRfq;
use App\Enums\RfqStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListAdminRfqsRequest;
use App\Http\Requests\Admin\RejectRfqRequest;
use App\Http\Requests\Admin\TriageRfqRequest;
use App\Http\Resources\Admin\AdminRfqResource;
use App\Models\Rfq;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Admin only — enforced by the `admin` middleware on the route group (routes/api.php), before model binding.
 * Triage queue for "I don't know the category" requests (M4a).
 */
class RfqController extends Controller
{
    /**
     * Default = the triage queue (pending_review), oldest first: the buyer who waited longest goes first.
     */
    public function index(ListAdminRfqsRequest $request): AnonymousResourceCollection
    {
        $status = $request->enum('status', RfqStatus::class) ?? RfqStatus::PendingReview;

        $rfqs = Rfq::query()
            ->with(AdminRfqResource::relations())
            ->withCount('attachments')
            ->where('status', $status)
            ->orderBy('id', $status === RfqStatus::PendingReview ? 'asc' : 'desc')
            ->paginate(20)
            ->withQueryString();

        return AdminRfqResource::collection($rfqs);
    }

    public function show(Rfq $rfq): AdminRfqResource
    {
        return $this->resource($rfq);
    }

    public function triage(TriageRfqRequest $request, Rfq $rfq, TriageRfq $action): AdminRfqResource
    {
        return $this->resource($action->assignCategory($rfq, $request->category(), $this->admin($request)));
    }

    public function reject(RejectRfqRequest $request, Rfq $rfq, TriageRfq $action): AdminRfqResource
    {
        return $this->resource($action->reject($rfq, $this->admin($request), $request->reason()));
    }

    private function resource(Rfq $rfq): AdminRfqResource
    {
        return new AdminRfqResource($rfq->load([...AdminRfqResource::relations(), 'attachments'])->loadCount('attachments'));
    }

    private function admin(Request $request): User
    {
        /** @var User $admin */
        $admin = $request->user();

        return $admin;
    }
}
