<?php

namespace App\Enums;

enum Fulfillment: string
{
    case Pickup = 'pickup';
    case SupplierDelivery = 'supplier_delivery';
    case Either = 'either';
}
