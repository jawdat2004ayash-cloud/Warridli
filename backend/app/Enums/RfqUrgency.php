<?php

namespace App\Enums;

enum RfqUrgency: string
{
    case Normal = 'normal';
    case Urgent = 'urgent';
    case LineStopped = 'line_stopped';
}
