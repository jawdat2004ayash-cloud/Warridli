<?php

namespace App\Http\Requests\Suppliers;

use App\Enums\CompanyType;
use App\Models\Company;
use App\Models\User;
use Illuminate\Auth\Access\Response;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Any supplier company (also while its account is still under review) may declare its specialties.
 */
class UpdateSupplierCategoriesRequest extends FormRequest
{
    public function authorize(): Response
    {
        return self::supplierCompany($this) !== null
            ? Response::allow()
            : Response::deny('تخصصات المورّد متاحة لحسابات المورّدين فقط.');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'category_ids' => ['present', 'array', 'max:50'],
            'category_ids.*' => ['integer', 'distinct', Rule::exists('categories', 'id')->where('is_active', true)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['category_ids.*.exists' => 'أحد التصنيفات المختارة غير متاح. حدّث الصفحة واختر من القائمة.'];
    }

    /**
     * @return list<int>
     */
    public function categoryIds(): array
    {
        /** @var array<int|string> $ids */
        $ids = $this->validated('category_ids');

        return array_values(array_map('intval', $ids));
    }

    /**
     * The user's supplier company in any status (suspended ones never get here: EnsureUserIsActive), or null.
     */
    public static function supplierCompany(Request $request): ?Company
    {
        $user = $request->user();
        $company = $user instanceof User ? $user->company() : null;

        return $company?->type === CompanyType::Supplier ? $company : null;
    }
}
