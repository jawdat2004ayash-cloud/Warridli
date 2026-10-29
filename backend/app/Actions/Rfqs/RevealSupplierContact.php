<?php

namespace App\Actions\Rfqs;

use App\Enums\RfqStatus;
use App\Models\ContactEvent;
use App\Models\Quote;
use App\Models\Rfq;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * D4/D33: the buyer starts the contact. The supplier's WhatsApp number is revealed only on request, only for a
 * quote the buyer can still act on, and every reveal is logged (contact_events, metric D12).
 *   open / expired → any visible quote; closed → only the chosen one; cancelled / other → none.
 */
class RevealSupplierContact
{
    /**
     * @return array{phone: string, whatsapp_url: string}
     */
    public function handle(Rfq $rfq, Quote $quote, User $buyer): array
    {
        $visible = Quote::query()->whereKey($quote->id)->where('rfq_id', $rfq->id)->visibleToBuyer()->with('supplierCompany')->first();
        if ($visible === null) {
            abort(409, 'لم يعد هذا العرض متاحاً (سحبه المورّد أو لم يعد المورّد مفعّلاً).');
        }

        $allowed = $rfq->status->isClosable()
            || ($rfq->status === RfqStatus::Closed && $rfq->selected_quote_id === $visible->id);
        if (! $allowed) {
            abort(409, $rfq->status === RfqStatus::Closed
                ? 'أغلقت هذا الطلب على عرض آخر، لذلك لا نُظهر رقم هذا المورّد.'
                : "لا يمكن التواصل بخصوص طلب حالته «{$rfq->status->label()}».");
        }

        $event = new ContactEvent;
        $event->forceFill(['rfq_id' => $rfq->id, 'quote_id' => $visible->id, 'user_id' => $buyer->id, 'channel' => 'whatsapp'])->save();

        $phone = $visible->supplierCompany->whatsapp_phone; // E.164, e.g. +9639XXXXXXXX
        $text = 'مرحباً، أتواصل معك من ورّدلي بخصوص عرضك على طلب: '.Str::limit($rfq->description, 80);

        return [
            'phone' => $phone,
            'whatsapp_url' => 'https://wa.me/'.ltrim($phone, '+').'?text='.rawurlencode($text),
        ];
    }
}
