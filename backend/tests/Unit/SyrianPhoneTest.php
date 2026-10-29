<?php

use App\Support\SyrianPhone;

it('normalizes Syrian mobile numbers to E.164', function (string $input) {
    expect(SyrianPhone::normalize($input))->toBe('+963944123456');
})->with([
    '0944123456',
    '0944 123 456',
    '0944-123-456',
    '944123456',
    '+963944123456',
    '+963 944 123 456',
    '00963944123456',
    '963944123456',
    '٠٩٤٤١٢٣٤٥٦',
    '۰۹۴۴۱۲۳۴۵۶',
]);

it('rejects anything that is not a Syrian mobile number', function (mixed $input) {
    expect(SyrianPhone::normalize($input))->toBeNull();
})->with([
    '0112223344',       // Damascus landline
    '+447700900123',
    '09441234567',      // too long
    '094412345',        // too short
    'abc0944123456',
    '0944123456; DROP',
    '',
    null,
    944123456,
]);
