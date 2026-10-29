<?php

namespace App\Enums;

/**
 * RFQ lifecycle (docs/ERD.md). M3a: create `open` / `pending_review`, buyer cancel. M3c: close (with or
 * without a chosen quote) and expiry. Admin triage / reject: M4a.
 */
enum RfqStatus: string
{
    case PendingReview = 'pending_review';
    case Open = 'open';
    case Closed = 'closed';
    case Cancelled = 'cancelled';
    case Expired = 'expired';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::PendingReview => 'قيد التصنيف',
            self::Open => 'مفتوح للعروض',
            self::Closed => 'مُغلق',
            self::Cancelled => 'مُلغى',
            self::Expired => 'منتهي',
            self::Rejected => 'مرفوض',
        };
    }

    public function isCancellable(): bool
    {
        return $this === self::PendingReview || $this === self::Open;
    }

    /**
     * The buyer may choose a quote or close without one while open, and also after the answer window
     * passed (expired = no NEW quotes; the ones received can still be chosen, D34).
     */
    public function isClosable(): bool
    {
        return $this === self::Open || $this === self::Expired;
    }
}
