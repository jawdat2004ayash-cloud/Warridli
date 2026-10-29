<?php

namespace App\Enums;

/**
 * Admin-driven company status changes (D22). Every other change of companies.status is a bug.
 *
 *   pending ──approve──▶ approved ──suspend──▶ suspended
 *      │                    ▲  ◀──reactivate──┘
 *      └──reject──▶ rejected ┘ (approve = reconsideration)
 */
enum CompanyTransition: string
{
    case Approve = 'approve';
    case Reject = 'reject';
    case Suspend = 'suspend';
    case Reactivate = 'reactivate';

    /**
     * @return list<CompanyStatus>
     */
    public function allowedFrom(): array
    {
        return match ($this) {
            self::Approve => [CompanyStatus::Pending, CompanyStatus::Rejected],
            self::Reject => [CompanyStatus::Pending],
            self::Suspend => [CompanyStatus::Approved],
            self::Reactivate => [CompanyStatus::Suspended],
        };
    }

    public function target(): CompanyStatus
    {
        return match ($this) {
            self::Approve, self::Reactivate => CompanyStatus::Approved,
            self::Reject => CompanyStatus::Rejected,
            self::Suspend => CompanyStatus::Suspended,
        };
    }

    /**
     * Vetting decisions; buyer companies are approved at registration and never reviewed.
     */
    public function isReview(): bool
    {
        return $this === self::Approve || $this === self::Reject;
    }

    public function requiresReason(): bool
    {
        return $this === self::Reject || $this === self::Suspend;
    }

    public function auditAction(): string
    {
        return match ($this) {
            self::Approve => 'company.approved',
            self::Reject => 'company.rejected',
            self::Suspend => 'company.suspended',
            self::Reactivate => 'company.reactivated',
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Approve => 'الموافقة',
            self::Reject => 'الرفض',
            self::Suspend => 'التعليق',
            self::Reactivate => 'إعادة التفعيل',
        };
    }
}
