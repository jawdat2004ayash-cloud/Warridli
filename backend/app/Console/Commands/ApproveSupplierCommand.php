<?php

namespace App\Console\Commands;

use App\Actions\Admin\TransitionCompanyStatus;
use App\Actions\Suppliers\ReviewSupplierCategory;
use App\Enums\CompanyStatus;
use App\Enums\CompanyTransition;
use App\Enums\CompanyType;
use App\Enums\SupplierCategoryStatus;
use App\Models\User;
use Illuminate\Console\Command;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Operator shortcut until the admin panel exists (M4a): approve a pending/rejected supplier company and all of
 * its pending specialties, through the same audited actions the admin API uses (actor = none, i.e. CLI).
 * Never changes passwords, never touches buyers, asks for confirmation unless --force.
 */
class ApproveSupplierCommand extends Command
{
    protected $signature = 'warridli:approve-supplier {email : Email of a member of the supplier company} {--force : Do not ask for confirmation}';

    protected $description = 'Approve a supplier company and its pending specialties (audited)';

    public function handle(TransitionCompanyStatus $transition, ReviewSupplierCategory $categories): int
    {
        $user = User::query()->where('email', mb_strtolower(trim((string) $this->argument('email'))))->first();
        $company = $user?->company();

        if ($company === null || $company->type !== CompanyType::Supplier) {
            $this->error('No supplier company found for this email.');

            return self::FAILURE;
        }

        $pending = $company->supplierCategories()->with('category')->where('status', SupplierCategoryStatus::Pending)->get();
        $this->line("Supplier: {$company->name} (status: {$company->status->value})");
        $this->line('Pending specialties: '.($pending->isEmpty() ? 'none' : $pending->map(fn ($row) => $row->category->name_ar)->implode('، ')));

        if (! $this->option('force') && ! $this->confirm('Approve this supplier and these specialties?')) {
            $this->line('Nothing changed.');

            return self::SUCCESS;
        }

        try {
            if ($company->status === CompanyStatus::Pending || $company->status === CompanyStatus::Rejected) {
                $transition->handle($company, CompanyTransition::Approve, null, null);
            } elseif ($company->status !== CompanyStatus::Approved) {
                $this->error("Company is {$company->status->value}; reactivate it through the admin API instead.");

                return self::FAILURE;
            }

            foreach ($pending as $row) {
                $categories->approve($company, $row->category, null);
            }
        } catch (HttpException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info('Approved. The supplier now receives open requests in its approved specialties.');

        return self::SUCCESS;
    }
}
