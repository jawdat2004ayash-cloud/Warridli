<?php

namespace App\Http\Requests\Rfqs;

use App\Enums\RfqUnit;
use App\Enums\RfqUrgency;
use App\Models\Category;
use App\Models\Rfq;
use Closure;
use Illuminate\Auth\Access\Response;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * multipart/form-data. `category` is an active category id or the literal "unknown" (→ admin triage):
 * an explicit choice, so a forgotten field never silently becomes "unknown".
 * Photo content is checked again by ImageSanitizer (decode + pixel limit) before anything is stored.
 */
class StoreRfqRequest extends FormRequest
{
    public const UNKNOWN_CATEGORY = 'unknown';

    public const MAX_PHOTOS = 5;

    /**
     * Runs before validation: a non-buyer gets 403 without learning anything about the payload rules.
     */
    public function authorize(): Response
    {
        return Gate::inspect('create', Rfq::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'description' => ['required', 'string', 'min:3', 'max:2000'],
            'part_number' => ['nullable', 'string', 'max:100'],
            'machine_make' => ['nullable', 'string', 'max:100'],
            'machine_model' => ['nullable', 'string', 'max:100'],
            'quantity' => ['required', 'integer', 'min:1', 'max:100000'],
            'unit' => ['required', Rule::enum(RfqUnit::class)],
            'urgency' => ['required', Rule::enum(RfqUrgency::class)],
            'area_id' => ['required', 'integer', Rule::exists('areas', 'id')],
            'category' => ['required', 'string', function (string $attribute, mixed $value, Closure $fail) {
                if ($value === self::UNKNOWN_CATEGORY) {
                    return;
                }
                if (! is_string($value) || ! ctype_digit($value) || ! Category::query()->whereKey((int) $value)->where('is_active', true)->exists()) {
                    $fail('اختر تصنيفاً من القائمة، أو اختر «لا أعرف التصنيف».');
                }
            }],
            'photos' => ['nullable', 'array', 'max:'.self::MAX_PHOTOS],
            'photos.*' => ['required', 'file', 'max:5120', 'mimetypes:image/jpeg,image/png,image/webp'],
        ];
    }

    public function messages(): array
    {
        return [
            'description.min' => 'اكتب وصفاً أوضح للقطعة (3 أحرف على الأقل).',
            'category.required' => 'اختر تصنيفاً، أو اختر «لا أعرف التصنيف».',
        ];
    }

    public function categoryId(): ?int
    {
        $category = $this->validated('category');

        return $category === self::UNKNOWN_CATEGORY ? null : (int) $category;
    }
}
