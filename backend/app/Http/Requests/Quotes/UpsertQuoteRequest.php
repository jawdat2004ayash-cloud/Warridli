<?php

namespace App\Http\Requests\Quotes;

use App\Enums\Currency;
use App\Enums\Fulfillment;
use App\Enums\QuoteCondition;
use App\Enums\StockStatus;
use Illuminate\Auth\Access\Response;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Quote fields (ERD). Approved supplier = `supplier` middleware; RFQ visibility = authorize() below;
 * whether the RFQ still accepts quotes is checked by the action under a row lock.
 */
class UpsertQuoteRequest extends FormRequest
{
    /** Longest validity a supplier may promise (D31). */
    public const MAX_VALID_DAYS = 60;

    /**
     * Before validation: an RFQ outside the supplier's visibility must answer 404 whatever the body is,
     * otherwise a 422 would reveal that it exists.
     */
    public function authorize(): Response
    {
        return Gate::inspect('quote', $this->route('rfq'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        // "Today" as the Damascus user sees it (D6b), not the UTC server date.
        $today = Carbon::now('Asia/Damascus')->startOfDay();

        return [
            // DECIMAL(14,2): up to 999,999,999,999.99; at most 2 decimals; strictly positive.
            'unit_price' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:999999999999.99'],
            'currency' => ['required', Rule::enum(Currency::class)],
            'condition' => ['required', Rule::enum(QuoteCondition::class)],
            'brand' => ['nullable', 'string', 'max:100'],
            'origin' => ['nullable', 'string', 'max:100'],
            'stock_status' => ['required', Rule::enum(StockStatus::class)],
            'lead_time_days' => ['nullable', 'required_if:stock_status,on_order', 'integer', 'min:1', 'max:365'],
            'fulfillment' => ['required', Rule::enum(Fulfillment::class)],
            'valid_until' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.$today->toDateString(), 'before_or_equal:'.$today->copy()->addDays(self::MAX_VALID_DAYS)->toDateString()],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'unit_price.gt' => 'السعر يجب أن يكون أكبر من صفر.',
            'unit_price.numeric' => 'اكتب السعر أرقاماً فقط، مثل 125000.',
            'unit_price.decimal' => 'السعر يقبل خانتين عشريتين على الأكثر.',
            'unit_price.max' => 'السعر كبير جداً. تحقّق من عدد الأصفار.',
            'lead_time_days.required_if' => 'اكتب خلال كم يوم تتوفر القطعة.',
            'valid_until.after_or_equal' => 'تاريخ صلاحية العرض لا يمكن أن يكون في الماضي.',
            'valid_until.before_or_equal' => 'صلاحية العرض '.self::MAX_VALID_DAYS.' يوماً كحد أقصى.',
            'valid_until.date_format' => 'اختر تاريخ صلاحية العرض من التقويم.',
        ];
    }
}
