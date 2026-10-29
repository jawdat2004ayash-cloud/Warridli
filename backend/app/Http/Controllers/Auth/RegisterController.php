<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\RegisterAccount;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\MeResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class RegisterController extends Controller
{
    public function __invoke(RegisterRequest $request, RegisterAccount $register): JsonResponse
    {
        // Sanctum only starts a session for requests from the SPA's stateful domains.
        abort_unless($request->hasSession(), 400, 'تعذّر بدء الجلسة. افتح ورّدلي من المتصفح وحاول مرة أخرى.');
        abort_if(Auth::guard('web')->check(), 409, 'أنت مسجّل الدخول حالياً. سجّل الخروج أولاً لإنشاء حساب جديد.');

        /** @var array{name: string, email: string, password: string, account_type: string, company_name: string, whatsapp_phone: string, area_id: int, address_text?: string|null} $data */
        $data = $request->validated();
        $user = $register->handle($data);

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return MeResource::for($user)->response()->setStatusCode(201);
    }
}
