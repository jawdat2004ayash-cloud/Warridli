<?php

namespace App\Http\Controllers;

use App\Http\Resources\NotificationResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * The current user's own in-app notifications (M4b, D39). Every query starts from $user->notifications(), so
 * another user's notification is indistinguishable from a missing one (404). Any authenticated, active user.
 */
class NotificationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['page' => ['nullable', 'integer', 'min:1']]);

        $notifications = $this->user($request)->notifications()->reorder()->orderByDesc('created_at')->orderByDesc('id')->paginate(20);

        return NotificationResource::collection($notifications)->additional([
            'meta' => ['unread' => $this->unreadCount($request)],
        ]);
    }

    /**
     * Polled by the header badge (every 60 s, A4): one indexed COUNT.
     */
    public function unread(Request $request): JsonResponse
    {
        return response()->json(['data' => ['unread' => $this->unreadCount($request)]]);
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        $row = $this->user($request)->notifications()->whereKey($notification)->firstOrFail();
        $row->markAsRead(); // no-op when already read

        // Wrapped by hand: the payload has its own `data` key, which stops Laravel's automatic wrapping.
        return response()->json(['data' => (new NotificationResource($row))->resolve($request)]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $this->user($request)->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['data' => ['unread' => 0]]);
    }

    private function unreadCount(Request $request): int
    {
        return $this->user($request)->unreadNotifications()->count();
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
