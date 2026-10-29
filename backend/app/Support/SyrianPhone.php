<?php

namespace App\Support;

/**
 * Normalizes Syrian mobile numbers as non-technical users type them
 * ("0944 123 456", "+963 944-123-456", "00963944123456", Arabic-Indic digits) to E.164 (+9639XXXXXXXX).
 */
final class SyrianPhone
{
    private const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

    private const LATIN = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    /**
     * Returns the E.164 form, or null when the input is not a Syrian mobile number.
     */
    public static function normalize(mixed $input): ?string
    {
        if (! is_string($input)) {
            return null;
        }

        $value = str_replace(self::ARABIC_INDIC, self::LATIN, trim($input));

        // Allow common separators only; anything else (letters, symbols) is rejected.
        if (preg_match('/^\+?[0-9\s\-().]+$/', $value) !== 1) {
            return null;
        }

        $digits = preg_replace('/\D/', '', $value) ?? '';

        $national = match (true) {
            str_starts_with($digits, '00963') => substr($digits, 5),
            str_starts_with($digits, '963') => substr($digits, 3),
            str_starts_with($digits, '0') => substr($digits, 1),
            default => $digits,
        };

        // Syrian mobile numbers: 9 followed by 8 digits.
        return preg_match('/^9\d{8}$/', $national) === 1 ? '+963'.$national : null;
    }
}
