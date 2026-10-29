<?php

namespace App\Actions\Admin;

use App\Models\User;
use App\Services\AuditLogger;
use App\Services\SessionRevoker;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Suspend / reactivate a single account (D23). Admin accounts are managed only from the CLI (D19),
 * so an admin can never lock out themselves or another admin from here.
 */
class SetUserSuspension
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly SessionRevoker $sessions,
    ) {}

    public function suspend(User $user, User $admin, string $reason): User
    {
        return $this->apply($user, $admin, $reason, suspend: true);
    }

    public function reactivate(User $user, User $admin, ?string $reason): User
    {
        return $this->apply($user, $admin, $reason, suspend: false);
    }

    private function apply(User $user, User $admin, ?string $reason, bool $suspend): User
    {
        DB::transaction(function () use ($user, $admin, $reason, $suspend) {
            /** @var User $locked */
            $locked = User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->is_admin) {
                abort(409, 'حسابات المدراء لا تُدار من هذه الواجهة.');
            }

            if ($locked->isSuspended() === $suspend) {
                abort(409, $suspend
                    ? 'هذا الحساب موقوف مسبقاً.'
                    : 'هذا الحساب مفعّل مسبقاً وغير موقوف.');
            }

            $locked->forceFill($suspend
                ? ['suspended_at' => now(), 'remember_token' => Str::random(60)]
                : ['suspended_at' => null]
            )->save();

            $revoked = $suspend ? $this->sessions->forUsers([(int) $locked->getKey()]) : 0;

            $this->audit->record($suspend ? 'user.suspended' : 'user.reactivated', $locked, [
                'reason' => $reason,
                'sessions_revoked' => $revoked,
            ], $admin);
        });

        return $user->refresh();
    }
}
