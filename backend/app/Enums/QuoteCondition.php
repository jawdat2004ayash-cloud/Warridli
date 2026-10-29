<?php

namespace App\Enums;

enum QuoteCondition: string
{
    case New = 'new';
    case Used = 'used';
    case Refurbished = 'refurbished';
}
