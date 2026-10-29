<?php

namespace App\Http\Resources\Admin;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Company;
use App\Models\Quote;
use App\Models\Rfq;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * One audit entry for the admin. meta is written by our own actions and never holds secrets (AuditLogger), but it
 * is filtered here again as defence in depth. Expects actor + subject eager-loaded.
 *
 * @mixin AuditLog
 */
class AuditLogResource extends JsonResource
{
    /** Keys that must never leave the server, even if some future action stored them by mistake. */
    private const SECRET_KEY = '/pass|token|secret|remember|cookie/i';

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var User|null $actor */
        $actor = $this->actor;

        return [
            'id' => $this->id,
            'action' => $this->action,
            'actor' => $actor === null ? null : [
                'id' => $actor->id,
                'name' => $actor->name,
                'email' => $actor->email,
                'is_admin' => $actor->is_admin,
            ],
            'subject' => $this->subject_type === null ? null : [
                'type' => $this->subject_type,
                'id' => $this->subject_id,
                'label' => $this->subjectLabel(),
                // RFQs are addressed by ULID everywhere in the UI.
                'ref' => $this->subject instanceof Rfq ? $this->subject->ulid : null,
            ],
            'meta' => $this->safeMeta(),
            'ip' => $this->ip,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }

    private function subjectLabel(): ?string
    {
        return match (true) {
            $this->subject instanceof Company => $this->subject->name,
            $this->subject instanceof User => $this->subject->name,
            $this->subject instanceof Category => $this->subject->name_ar,
            $this->subject instanceof Rfq => Str::limit($this->subject->description, 60),
            $this->subject instanceof Quote => null,
            default => null,
        };
    }

    /**
     * @return array<string, scalar|null>|null
     */
    private function safeMeta(): ?array
    {
        if (! is_array($this->meta)) {
            return null;
        }

        $safe = [];
        foreach ($this->meta as $key => $value) {
            if (preg_match(self::SECRET_KEY, $key) !== 1 && (is_scalar($value) || $value === null)) {
                $safe[$key] = $value;
            }
        }

        return $safe;
    }
}
