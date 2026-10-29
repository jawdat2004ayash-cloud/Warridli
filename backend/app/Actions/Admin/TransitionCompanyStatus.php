<?php

namespace App\Actions\Admin;

use App\Enums\CompanyTransition;
use App\Enums\CompanyType;
use App\Enums\NotificationKind;
use App\Models\Company;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Notifier;
use App\Services\SessionRevoker;
use Illuminate\Support\Facades\DB;

/**
 * The only code path that changes companies.status after registration (D22).
 * The row is locked for the check-and-update, so two admins acting at once cannot both "win".
 * $admin is null only from the CLI (warridli:approve-supplier); the audit row then has no actor.
 */
class TransitionCompanyStatus
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly SessionRevoker $sessions,
        private readonly Notifier $notifier,
    ) {}

    public function handle(Company $company, CompanyTransition $transition, ?User $admin, ?string $reason): Company
    {
        DB::transaction(function () use ($company, $transition, $admin, $reason) {
            /** @var Company $locked */
            $locked = Company::query()->whereKey($company->getKey())->lockForUpdate()->firstOrFail();
            $from = $locked->status;

            if ($transition->isReview() && $locked->type !== CompanyType::Supplier) {
                abort(409, 'حسابات المشترين لا تحتاج إلى مراجعة. يمكن تعليقها أو إعادة تفعيلها فقط.');
            }

            if (! in_array($from, $transition->allowedFrom(), true)) {
                abort(409, "لا يمكن تنفيذ {$transition->label()} على شركة حالتها الآن «{$from->label()}». حدّث الصفحة لترى الحالة الحالية.");
            }

            $changes = ['status' => $transition->target()];
            if ($transition->isReview()) {
                $changes += ['verified_by' => $admin?->getKey(), 'verified_at' => now()];
            }
            $locked->forceFill($changes)->save();

            $revoked = $transition === CompanyTransition::Suspend
                ? $this->sessions->forUsers($locked->members()->pluck('user_id')->map(fn ($id) => (int) $id)->values()->all())
                : 0;

            $log = $this->audit->record($transition->auditAction(), $locked, [
                'from' => $from->value,
                'to' => $transition->target()->value,
                'company_type' => $locked->type->value,
                'reason' => $reason,
                'sessions_revoked' => $revoked,
            ], $admin);

            // The review outcome is news for the supplier (M4b). Suspension logs everyone out; reactivation is visible on login.
            $kind = match ($transition) {
                CompanyTransition::Approve => NotificationKind::SupplierApproved,
                CompanyTransition::Reject => NotificationKind::SupplierRejected,
                default => null,
            };
            if ($kind !== null) {
                $this->notifier->toCompany($locked, $kind, "audit:{$log->id}", []);
            }
        });

        return $company->refresh();
    }
}
