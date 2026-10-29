<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\MeResource;
use App\Models\User;
use Illuminate\Http\Request;

class MeController extends Controller
{
    /**
     * Always the session's own user; there is no way to address another user here.
     */
    public function __invoke(Request $request): MeResource
    {
        /** @var User $user */
        $user = $request->user();

        return MeResource::for($user);
    }
}
