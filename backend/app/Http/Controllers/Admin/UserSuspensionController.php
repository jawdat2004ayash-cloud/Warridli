<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\SetUserSuspension;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminReasonRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Admin only — enforced by the `admin` middleware on the route group (routes/api.php).
 * Deliberately no user listing / profile endpoint: admins find users through their company (AdminCompanyResource).
 */
class UserSuspensionController extends Controller
{
    public function __construct(private readonly SetUserSuspension $action) {}

    public function suspend(AdminReasonRequest $request, User $user): JsonResponse
    {
        return $this->respond($this->action->suspend($user, $this->admin($request), (string) $request->reason()));
    }

    public function reactivate(AdminReasonRequest $request, User $user): JsonResponse
    {
        return $this->respond($this->action->reactivate($user, $this->admin($request), $request->reason()));
    }

    private function admin(AdminReasonRequest $request): User
    {
        /** @var User $admin */
        $admin = $request->user();

        return $admin;
    }

    private function respond(User $user): JsonResponse
    {
        return response()->json(['data' => [
            'id' => $user->id,
            'name' => $user->name,
            'suspended' => $user->isSuspended(),
        ]]);
    }
}
