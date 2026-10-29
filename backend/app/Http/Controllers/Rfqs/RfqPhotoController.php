<?php

namespace App\Http\Controllers\Rfqs;

use App\Actions\Rfqs\CreateRfq;
use App\Http\Controllers\Controller;
use App\Models\Rfq;
use App\Models\RfqAttachment;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Streams a private RFQ photo after the same check as viewing the RFQ — as its buyer, or as a supplier the RFQ
 * is visible to (scoped binding: the photo must belong to that RFQ). Headers stop browsers from sniffing or
 * executing it and keep it out of shared caches.
 */
class RfqPhotoController extends Controller
{
    public function forBuyer(Rfq $rfq, RfqAttachment $attachment): StreamedResponse
    {
        Gate::authorize('view', $rfq);

        return $this->stream($attachment);
    }

    public function forSupplier(Rfq $rfq, RfqAttachment $attachment): StreamedResponse
    {
        Gate::authorize('viewAsSupplier', $rfq);

        return $this->stream($attachment);
    }

    /**
     * Admins (route middleware `admin`, before binding) inspect photos of any RFQ, e.g. to triage it (M4a).
     */
    public function forAdmin(Rfq $rfq, RfqAttachment $attachment): StreamedResponse
    {
        return $this->stream($attachment);
    }

    private function stream(RfqAttachment $attachment): StreamedResponse
    {
        $disk = Storage::disk(CreateRfq::DISK);
        abort_unless($disk->exists($attachment->path), 404);

        return $disk->response($attachment->path, null, [
            'Content-Type' => $attachment->mime,
            'Content-Disposition' => 'inline',
            // A fresh browser-cache hit must not bypass authorization after logout or suspension.
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'",
        ]);
    }
}
