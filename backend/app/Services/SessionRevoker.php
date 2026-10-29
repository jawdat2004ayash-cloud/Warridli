<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Deletes stored sessions (database session driver) so affected users are logged out everywhere at once.
 * EnsureUserIsActive still re-checks on every request, so this is defence in depth, not the only barrier.
 */
class SessionRevoker
{
    /**
     * @param  list<int>  $userIds
     * @return int number of sessions deleted
     */
    public function forUsers(array $userIds): int
    {
        if ($userIds === [] || config('session.driver') !== 'database') {
            return 0;
        }

        return DB::table((string) config('session.table', 'sessions'))->whereIn('user_id', $userIds)->delete();
    }
}
