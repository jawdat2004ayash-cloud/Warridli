<?php

namespace App\Models;

use App\Enums\CompanyStatus;
use App\Notifications\ResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * is_admin and suspended_at are deliberately NOT fillable: they can only be set with forceFill()
 * by trusted code (console command, admin actions), never from request payloads.
 */
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Mirror the DB defaults so freshly created models are complete (strict mode).
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'is_admin' => false,
        'suspended_at' => null,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'suspended_at' => 'datetime',
        ];
    }

    /**
     * D9: a user belongs to at most one company. Admin accounts have none.
     *
     * @return HasOne<CompanyMember, $this>
     */
    public function membership(): HasOne
    {
        return $this->hasOne(CompanyMember::class);
    }

    public function isSuspended(): bool
    {
        return $this->suspended_at !== null;
    }

    public function company(): ?Company
    {
        return $this->loadMissing('membership.company')->membership?->company;
    }

    /**
     * Why this user may not use the app at all right now (suspended account or suspended company), or null.
     * Checked at login and on every authenticated request (EnsureUserIsActive).
     */
    public function accessBlockedMessage(): ?string
    {
        if ($this->isSuspended()) {
            return 'هذا الحساب موقوف. تواصل مع إدارة ورّدلي لمعرفة السبب.';
        }

        if ($this->company()?->status === CompanyStatus::Suspended) {
            return 'حساب شركتك موقوف حالياً. تواصل مع إدارة ورّدلي لمعرفة السبب.';
        }

        return null;
    }

    /**
     * Send the (queued, Arabic) password reset link pointing to the SPA.
     *
     * @param  string  $token
     */
    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }
}
