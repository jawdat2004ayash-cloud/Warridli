<?php

namespace App\Enums;

enum CompanyStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Suspended = 'suspended';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'قيد المراجعة',
            self::Approved => 'معتمدة',
            self::Rejected => 'مرفوضة',
            self::Suspended => 'موقوفة',
        };
    }
}
