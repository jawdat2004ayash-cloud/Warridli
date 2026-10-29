<?php

namespace App\Http\Requests\Auth;

use App\Enums\CompanyType;
use App\Support\SyrianPhone;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    /**
     * Normalize what non-technical users type before validating it.
     */
    protected function prepareForValidation(): void
    {
        $email = $this->input('email');
        $phone = $this->input('whatsapp_phone');

        $this->merge([
            'email' => is_string($email) ? mb_strtolower(trim($email)) : $email,
            // Unparseable numbers become 'invalid' so the regex rule below reports a clear message.
            'whatsapp_phone' => is_string($phone) && trim($phone) !== '' ? (SyrianPhone::normalize($phone) ?? 'invalid') : $phone,
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['required', 'string', 'email:rfc', 'max:254', 'unique:users,email'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
            'account_type' => ['required', 'string', Rule::enum(CompanyType::class)],
            'company_name' => ['required', 'string', 'min:2', 'max:150'],
            'whatsapp_phone' => ['required', 'string', 'regex:/^\+9639\d{8}$/'],
            'area_id' => ['required', 'integer', 'exists:areas,id'],
            'address_text' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'whatsapp_phone.regex' => 'رقم الواتساب غير صحيح. اكتب رقم موبايل سوري مثل 0944123456.',
            'email.unique' => 'هذا البريد مسجّل مسبقاً. جرّب تسجيل الدخول أو استعادة كلمة المرور.',
        ];
    }
}
