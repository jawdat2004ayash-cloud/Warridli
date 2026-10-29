<?php

namespace App\Models;

use Database\Factories\AreaFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name_ar', 'sort'])]
class Area extends Model
{
    /** @use HasFactory<AreaFactory> */
    use HasFactory;
}
