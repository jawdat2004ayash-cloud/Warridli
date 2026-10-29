<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MetricsRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'period' => ['nullable', Rule::in(['7', '30', '90', 'all'])],
        ];
    }

    /**
     * Number of days, or null for "since the start". Default: 30 days.
     */
    public function days(): ?int
    {
        $period = $this->validated('period');
        $period = is_string($period) ? $period : '30';

        return $period === 'all' ? null : (int) $period;
    }
}
