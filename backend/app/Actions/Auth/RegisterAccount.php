<?php

namespace App\Actions\Auth;

use App\Enums\CompanyRole;
use App\Enums\CompanyType;
use App\Models\Company;
use App\Models\CompanyMember;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

class RegisterAccount
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Creates the user, their company and the owner membership atomically.
     * Company status is decided here (never by the client): buyers are approved, suppliers pending vetting.
     *
     * @param  array{name: string, email: string, password: string, account_type: string, company_name: string, whatsapp_phone: string, area_id: int, address_text?: string|null}  $data
     */
    public function handle(array $data): User
    {
        return DB::transaction(function () use ($data) {
            $type = CompanyType::from($data['account_type']);

            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
            ]);

            $company = new Company([
                'type' => $type,
                'name' => $data['company_name'],
                'whatsapp_phone' => $data['whatsapp_phone'],
                'area_id' => $data['area_id'],
                'address_text' => $data['address_text'] ?? null,
            ]);
            $company->status = $type->initialStatus();
            $company->save();

            $membership = new CompanyMember;
            $membership->company()->associate($company);
            $membership->user()->associate($user);
            $membership->role = CompanyRole::Owner;
            $membership->save();

            $this->audit->record('auth.registered', $user, [
                'company_id' => $company->id,
                'company_type' => $type->value,
            ], $user);

            return $user;
        });
    }
}
