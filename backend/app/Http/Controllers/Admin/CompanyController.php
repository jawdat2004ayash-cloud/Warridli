<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\TransitionCompanyStatus;
use App\Enums\CompanyStatus;
use App\Enums\CompanyTransition;
use App\Enums\SupplierCategoryStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminReasonRequest;
use App\Http\Requests\Admin\ListCompaniesRequest;
use App\Http\Resources\Admin\AdminCompanyResource;
use App\Models\Company;
use App\Models\User;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Admin only — enforced by the `admin` middleware on the route group (routes/api.php).
 */
class CompanyController extends Controller
{
    /**
     * Review queue and company directory. Pending companies oldest first (first come, first reviewed).
     */
    public function index(ListCompaniesRequest $request): AnonymousResourceCollection
    {
        $status = $request->enum('status', CompanyStatus::class);
        $type = $request->string('type')->value();
        $pendingCategories = $request->boolean('pending_categories');
        $search = $request->string('q')->trim()->value();
        $like = '%'.addcslashes($search, '\\%_').'%';

        $companies = Company::query()
            ->with(AdminCompanyResource::relations())
            ->when($status !== null, fn ($query) => $query->where('status', $status))
            ->when($type !== '', fn ($query) => $query->where('type', $type))
            ->when($pendingCategories, fn ($query) => $query
                ->whereHas('supplierCategories', fn ($rows) => $rows->where('status', SupplierCategoryStatus::Pending)))
            ->when($search !== '', fn ($query) => $query->where(fn ($match) => $match
                ->where('name', 'like', $like)
                ->orWhereHas('members.user', fn ($user) => $user->where('email', 'like', $like))))
            // Queues (pending company or pending specialty) oldest first: first come, first reviewed.
            ->orderBy('id', $status === CompanyStatus::Pending || $pendingCategories ? 'asc' : 'desc')
            ->paginate(20)
            ->withQueryString();

        return AdminCompanyResource::collection($companies);
    }

    public function transition(AdminReasonRequest $request, Company $company, CompanyTransition $transition, TransitionCompanyStatus $action): AdminCompanyResource
    {
        /** @var User $admin */
        $admin = $request->user();

        $company = $action->handle($company, $transition, $admin, $request->reason());

        return new AdminCompanyResource($company->load(AdminCompanyResource::relations()));
    }
}
