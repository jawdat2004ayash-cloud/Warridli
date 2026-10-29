<?php

namespace App\Http\Requests\Admin;

use App\Enums\CompanyStatus;
use App\Enums\CompanyType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListCompaniesRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::enum(CompanyStatus::class)],
            'type' => ['nullable', Rule::enum(CompanyType::class)],
            // Suppliers (any status) with a specialty request waiting for a decision (D30).
            'pending_categories' => ['nullable', 'boolean'],
            // Company name, or the email of one of its members.
            'q' => ['nullable', 'string', 'min:2', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
