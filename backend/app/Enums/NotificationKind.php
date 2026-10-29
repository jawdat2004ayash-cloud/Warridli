<?php

namespace App\Enums;

/**
 * In-app notification types (M4b, D39). The text is written by the SPA from the kind + data, so the stored
 * payload stays small and language-neutral.
 */
enum NotificationKind: string
{
    /** To the supplier company's members. */
    case SupplierApproved = 'supplier_approved';
    case SupplierRejected = 'supplier_rejected';
    case SpecialtyApproved = 'specialty_approved';
    case SpecialtyRejected = 'specialty_rejected';
    /** A new open RFQ in one of the supplier's approved specialties. */
    case RfqMatched = 'rfq_matched';
    /** The buyer's chosen quote — only to the chosen supplier (nothing is sent to the others, D33). */
    case QuoteSelected = 'quote_selected';

    /** To the buyer company's members. */
    case QuoteReceived = 'quote_received';
    case RfqTriaged = 'rfq_triaged';
    case RfqRejected = 'rfq_rejected';
}
