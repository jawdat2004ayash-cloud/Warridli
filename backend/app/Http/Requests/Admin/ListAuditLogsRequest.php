<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Filters for the audit trail. `group` is the part of the action before the dot (company.approved → company).
 * Dates are Damascus calendar days (D6b).
 */
class ListAuditLogsRequest extends FormRequest
{
    public const GROUPS = ['auth', 'admin', 'company', 'user', 'supplier_category', 'category', 'rfq', 'quote'];

    public const SUBJECT_TYPES = ['user', 'company', 'rfq', 'quote', 'category'];

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'group' => ['nullable', Rule::in(self::GROUPS)],
            // admin = done by an admin account; system = no actor (scheduler, CLI).
            'actor' => ['nullable', Rule::in(['admin', 'system'])],
            'subject_type' => ['nullable', 'required_with:subject_id', Rule::in(self::SUBJECT_TYPES)],
            'subject_id' => ['nullable', 'required_with:subject_type', 'integer', 'min:1'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
