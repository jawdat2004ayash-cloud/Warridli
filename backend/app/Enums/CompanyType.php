<?php

namespace App\Enums;

enum CompanyType: string
{
    case Buyer = 'buyer';
    case Supplier = 'supplier';

    /**
     * Status a newly registered company starts with: suppliers are vetted by an admin (M2c).
     */
    public function initialStatus(): CompanyStatus
    {
        return match ($this) {
            self::Buyer => CompanyStatus::Approved,
            self::Supplier => CompanyStatus::Pending,
        };
    }
}
