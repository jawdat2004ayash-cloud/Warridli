<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditLogger
{
    public function __construct(private readonly ?Request $request = null) {}

    /**
     * Record a security-relevant action. Never pass passwords, tokens or other secrets in $meta.
     *
     * @param  array<string, scalar|null>  $meta
     */
    public function record(string $action, ?Model $subject = null, array $meta = [], ?User $actor = null): AuditLog
    {
        $log = new AuditLog;
        $log->forceFill([
            'actor_user_id' => $actor?->getKey(),
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'meta' => $meta === [] ? null : $meta,
            'ip' => $this->request?->ip(),
        ])->save();

        return $log;
    }
}
