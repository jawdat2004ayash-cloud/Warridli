<?php

namespace App\Policies;

use App\Enums\CompanyStatus;
use App\Enums\CompanyType;
use App\Models\Company;
use App\Models\Rfq;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Buyer side of RFQs (M3a). Ownership is per company, so colleagues in one company share requests.
 * Someone else's RFQ is answered with 404, never 403, so ULIDs cannot be probed (API.md).
 * Suppliers use the *AsSupplier / quote abilities (M3b); admins have none here.
 */
class RfqPolicy
{
    public function viewAny(User $user): Response
    {
        return $this->asBuyer($user);
    }

    public function create(User $user): Response
    {
        return $this->asBuyer($user);
    }

    public function view(User $user, Rfq $rfq): Response
    {
        $company = $user->company();

        return $company !== null && $company->type === CompanyType::Buyer && $rfq->buyer_company_id === $company->id
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function cancel(User $user, Rfq $rfq): Response
    {
        return $this->view($user, $rfq);
    }

    /**
     * Close / choose a quote / reveal a supplier's contact (M3c): owner only; state rules live in the actions (409).
     */
    public function close(User $user, Rfq $rfq): Response
    {
        return $this->view($user, $rfq);
    }

    /**
     * Supplier side (M3b). The `supplier` middleware already guarantees an approved supplier company;
     * anything outside Rfq::visibleToSupplier() is indistinguishable from a non-existent RFQ (404).
     */
    public function viewAsSupplier(User $user, Rfq $rfq): Response
    {
        $company = $this->approvedSupplier($user);

        return $company !== null && Rfq::query()->whereKey($rfq->id)->visibleToSupplier($company)->exists()
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    /**
     * Visible RFQs the supplier may no longer quote on (closed, cancelled, expired, category removed) give a clear
     * 409 from the quote actions, which re-check under a row lock; this only hides foreign RFQs.
     */
    public function quote(User $user, Rfq $rfq): Response
    {
        return $this->viewAsSupplier($user, $rfq);
    }

    private function approvedSupplier(User $user): ?Company
    {
        $company = $user->company();

        return $company !== null && $company->type === CompanyType::Supplier && $company->status === CompanyStatus::Approved
            ? $company
            : null;
    }

    private function asBuyer(User $user): Response
    {
        $company = $user->company();

        if ($company === null || $company->type !== CompanyType::Buyer) {
            return Response::deny('طلبات الأسعار متاحة لحسابات المشترين (الورش والمعامل) فقط.');
        }

        // Buyers are approved at registration; a suspended company never gets here (EnsureUserIsActive).
        return $company->status === CompanyStatus::Approved
            ? Response::allow()
            : Response::deny('حساب منشأتك غير مفعّل حالياً. تواصل مع إدارة ورّدلي.');
    }
}
