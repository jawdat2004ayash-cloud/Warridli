<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Admin only (route middleware). The category an "unknown category" RFQ belongs to — active ones only.
 */
class TriageRfqRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer', Rule::exists('categories', 'id')->where('is_active', true)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'category_id.required' => 'اختر التصنيف المناسب للقطعة.',
            'category_id.exists' => 'هذا التصنيف غير متاح. اختر تصنيفاً مفعّلاً من القائمة.',
        ];
    }

    public function category(): Category
    {
        return Category::query()->findOrFail((int) $this->validated('category_id'));
    }
}
