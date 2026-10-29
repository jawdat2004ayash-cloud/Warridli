<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Admin only (route middleware). Create: name (+ optional order). Update: any of name, order, active.
 * Slug and ids are never taken from the client.
 */
class SaveCategoryRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $name = $this->input('name_ar');
        if (is_string($name)) {
            $this->merge(['name_ar' => preg_replace('/\s+/u', ' ', trim($name))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $category = $this->route('category');
        $existing = $category instanceof Category ? $category : null;

        return [
            'name_ar' => [$existing === null ? 'required' : 'sometimes', 'string', 'min:2', 'max:100',
                Rule::unique('categories', 'name_ar')->ignore($existing?->id)],
            'sort' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => [$existing === null ? 'prohibited' : 'sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name_ar.required' => 'اكتب اسم التصنيف.',
            'name_ar.unique' => 'يوجد تصنيف بهذا الاسم. اختر اسماً مختلفاً أو عدّل التصنيف الموجود.',
            'is_active.prohibited' => 'التصنيف الجديد يُضاف مفعّلاً.',
        ];
    }

    /**
     * @return array{name_ar?: string, sort?: int|null, is_active?: bool}
     */
    public function categoryData(): array
    {
        /** @var array<string, mixed> $valid */
        $valid = $this->validated();
        $data = [];
        if (array_key_exists('name_ar', $valid)) {
            $data['name_ar'] = (string) $valid['name_ar'];
        }
        if (array_key_exists('sort', $valid)) {
            $data['sort'] = $valid['sort'] === null ? null : (int) $valid['sort'];
        }
        if (array_key_exists('is_active', $valid)) {
            $data['is_active'] = (bool) $valid['is_active'];
        }

        return $data;
    }
}
