<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/**
 * The only way to create an admin. The password is read from a hidden prompt — never from an
 * argument/option (shell history, process list) — and is never printed or logged.
 */
class CreateAdminCommand extends Command
{
    protected $signature = 'warridli:create-admin
                            {email : Admin email address}
                            {--name=Warridli Admin : Display name}';

    protected $description = 'Create a Warridli admin account (interactive; password via hidden prompt)';

    public function handle(AuditLogger $audit): int
    {
        if (! $this->input->isInteractive()) {
            $this->error('This command must be run interactively (the password is read from a hidden prompt).');

            return self::FAILURE;
        }

        $email = mb_strtolower(trim((string) $this->argument('email')));
        $name = trim((string) $this->option('name'));

        $identity = Validator::make(
            ['email' => $email, 'name' => $name],
            ['email' => ['required', 'email:rfc', 'max:254'], 'name' => ['required', 'string', 'min:2', 'max:100']],
        );

        if ($identity->fails()) {
            $this->error('Invalid email or name.');

            return self::FAILURE;
        }

        if (User::query()->where('email', $email)->exists()) {
            // Never silently promote an existing (possibly buyer/supplier) account.
            $this->error('A user with this email already exists. No changes were made.');

            return self::FAILURE;
        }

        $password = (string) $this->secret('Password (min 8 chars, letters and numbers)');
        $confirmation = (string) $this->secret('Confirm password');

        $validator = Validator::make(
            ['password' => $password, 'password_confirmation' => $confirmation],
            ['password' => ['required', 'confirmed', Password::defaults()]],
        );

        if ($validator->fails()) {
            $this->error('Password rejected: use at least 8 characters with letters and numbers, at most 72 bytes, no null bytes, and matching entries.');

            return self::FAILURE;
        }

        $user = DB::transaction(function () use ($email, $name, $password, $audit) {
            $user = new User(['name' => $name, 'email' => $email, 'password' => $password]);
            $user->forceFill(['is_admin' => true, 'email_verified_at' => now()])->save();

            $audit->record('admin.created', $user, ['source' => 'console']);

            return $user;
        });

        $this->info("Admin account created for {$user->email}.");

        return self::SUCCESS;
    }
}
