<?php

namespace App\Actions\Rfqs;

use App\Enums\RfqStatus;
use App\Models\Company;
use App\Models\Rfq;
use App\Models\RfqAttachment;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ImageSanitizer;
use App\Services\Notifier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Creates an RFQ with its photos in one transaction. Photos are sanitized before anything is written;
 * if the transaction fails, files already written are removed again (no orphans on the disk).
 */
class CreateRfq
{
    /** Default answer window; quote expiry/close flows arrive in M3c (D26). */
    public const OPEN_DAYS = 7;

    public const DISK = 'local';

    public function __construct(
        private readonly ImageSanitizer $images,
        private readonly AuditLogger $audit,
        private readonly Notifier $notifier,
    ) {}

    /**
     * @param  array{description: string, part_number?: string|null, machine_make?: string|null, machine_model?: string|null, quantity: int|string, unit: string, urgency: string, area_id: int|string}  $data
     * @param  list<UploadedFile>  $photos
     */
    public function handle(User $user, Company $company, array $data, ?int $categoryId, array $photos): Rfq
    {
        $images = [];
        foreach ($photos as $index => $photo) {
            $images[] = $this->images->toJpeg($photo) ?? throw ValidationException::withMessages([
                "photos.{$index}" => 'تعذّر قراءة الصورة رقم '.($index + 1).'. اختر صورة JPG أو PNG أو WebP سليمة وبحجم معقول.',
            ]);
        }

        $written = [];
        $disk = Storage::disk(self::DISK);

        try {
            return DB::transaction(function () use ($user, $company, $data, $categoryId, $images, $disk, &$written) {
                $rfq = new Rfq;
                $rfq->forceFill([
                    'buyer_company_id' => $company->id,
                    'created_by' => $user->id,
                    'category_id' => $categoryId,
                    'status' => $categoryId === null ? RfqStatus::PendingReview : RfqStatus::Open,
                    'description' => $data['description'],
                    'part_number' => $data['part_number'] ?? null,
                    'machine_make' => $data['machine_make'] ?? null,
                    'machine_model' => $data['machine_model'] ?? null,
                    'quantity' => (int) $data['quantity'],
                    'unit' => $data['unit'],
                    'urgency' => $data['urgency'],
                    'area_id' => (int) $data['area_id'],
                    'closes_at' => now()->addDays(self::OPEN_DAYS),
                ])->save();

                foreach ($images as $image) {
                    $path = "rfq-photos/{$rfq->ulid}/".Str::lower((string) Str::ulid()).'.jpg';
                    if (! $disk->put($path, $image['binary'])) {
                        throw new \RuntimeException('Could not store an RFQ photo.');
                    }
                    $written[] = $path;

                    $attachment = new RfqAttachment;
                    $attachment->forceFill([
                        'rfq_id' => $rfq->id,
                        'path' => $path,
                        'mime' => 'image/jpeg',
                        'size' => strlen($image['binary']),
                        'width' => $image['width'],
                        'height' => $image['height'],
                    ])->save();
                }

                $this->audit->record('rfq.created', $rfq, [
                    'status' => $rfq->status->value,
                    'category_id' => $categoryId,
                    'photos' => count($images),
                ], $user);

                // Known category → the targeted suppliers hear about it now; unknown → after admin triage.
                $this->notifier->rfqMatched($rfq);

                return $rfq;
            });
        } catch (Throwable $e) {
            foreach ($written as $path) {
                $disk->delete($path);
            }
            throw $e;
        }
    }
}
