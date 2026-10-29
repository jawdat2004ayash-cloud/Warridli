<?php

namespace App\Actions\Admin;

use App\Actions\Rfqs\CreateRfq;
use App\Enums\NotificationKind;
use App\Enums\RfqStatus;
use App\Models\Category;
use App\Models\Rfq;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Notifier;
use Illuminate\Support\Facades\DB;

/**
 * Manual triage of "I don't know the category" requests (ERD state machine): pending_review -> open with the
 * category the admin chose (the targeted suppliers see it from now on), or pending_review -> rejected (spam,
 * not a part request). Row-locked and audited; any other current state -> 409 with nothing changed.
 */
class TriageRfq
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly Notifier $notifier,
    ) {}

    /**
     * The answer window starts when suppliers can see the request, not when the buyer sent it (D35).
     */
    public function assignCategory(Rfq $rfq, Category $category, User $admin): Rfq
    {
        DB::transaction(function () use ($rfq, $category, $admin) {
            $locked = $this->lockPending($rfq, 'تصنيف');

            // Re-read under a lock: the category may have been deactivated since the form was loaded.
            $active = Category::query()->whereKey($category->id)->where('is_active', true)->lockForUpdate()->exists();
            if (! $active) {
                abort(409, 'هذا التصنيف معطّل الآن. اختر تصنيفاً مفعّلاً.');
            }

            $locked->forceFill([
                'category_id' => $category->id,
                'status' => RfqStatus::Open,
                'closes_at' => now()->addDays(CreateRfq::OPEN_DAYS),
                'triaged_by' => $admin->id,
                'triaged_at' => now(),
            ])->save();

            $this->audit->record('rfq.triaged', $locked, [
                'from' => RfqStatus::PendingReview->value,
                'category_id' => $category->id,
                'closes_at' => $locked->closes_at->toIso8601String(),
            ], $admin);

            $this->notifier->rfqMatched($locked);
            $this->notifier->toCompany($locked->buyerCompany()->firstOrFail(), NotificationKind::RfqTriaged, "rfq:{$locked->id}:triage", Notifier::rfqData($locked));
        });

        return $rfq->refresh();
    }

    public function reject(Rfq $rfq, User $admin, string $reason): Rfq
    {
        DB::transaction(function () use ($rfq, $admin, $reason) {
            $locked = $this->lockPending($rfq, 'رفض');

            $locked->forceFill([
                'status' => RfqStatus::Rejected,
                'triaged_by' => $admin->id,
                'triaged_at' => now(),
            ])->save();

            $this->audit->record('rfq.rejected', $locked, [
                'from' => RfqStatus::PendingReview->value,
                'reason' => $reason,
            ], $admin);

            $this->notifier->toCompany($locked->buyerCompany()->firstOrFail(), NotificationKind::RfqRejected, "rfq:{$locked->id}:triage", Notifier::rfqData($locked));
        });

        return $rfq->refresh();
    }

    private function lockPending(Rfq $rfq, string $verb): Rfq
    {
        /** @var Rfq $locked */
        $locked = Rfq::query()->whereKey($rfq->getKey())->lockForUpdate()->firstOrFail();

        if ($locked->status !== RfqStatus::PendingReview) {
            abort(409, "لا يمكن {$verb} طلب حالته «{$locked->status->label()}». ربما عالجه مدير آخر أو ألغاه المشتري؛ حدّث الصفحة.");
        }

        return $locked;
    }
}
