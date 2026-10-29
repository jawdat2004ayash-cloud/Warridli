<?php

namespace App\Enums;

enum StockStatus: string
{
    case InStock = 'in_stock';
    case OnOrder = 'on_order';
}
