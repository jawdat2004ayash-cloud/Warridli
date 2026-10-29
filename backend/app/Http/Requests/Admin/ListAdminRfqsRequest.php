<?php

namespace App\Http\Requests\Admin;

use App\Enums\RfqStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListAdminRfqsRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::enum(RfqStatus::class)],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
