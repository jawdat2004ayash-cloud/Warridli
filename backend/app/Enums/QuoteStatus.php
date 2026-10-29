<?php

namespace App\Enums;

enum QuoteStatus: string
{
    case Submitted = 'submitted';
    case Withdrawn = 'withdrawn';
}
