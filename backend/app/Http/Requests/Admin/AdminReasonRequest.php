<?php

namespace App\Http\Requests\Admin;

use App\Enums\CompanyTransition;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Body of every admin status action: an optional note, required where the affected party deserves an explanation
 * (reject, suspend). Stored in audit_logs.meta — it is admin-written text, never a secret.
 */
class AdminReasonRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'reason' => [$this->reasonRequired() ? 'required' : 'nullable', 'string', 'min:5', 'max:500'],
        ];
    }

    public function reason(): ?string
    {
        $reason = $this->validated('reason');

        return is_string($reason) ? $reason : null;
    }

    private function reasonRequired(): bool
    {
        if ($this->routeIs('admin.users.suspend')) {
            return true;
        }

        $transition = $this->route('transition');
        if (is_string($transition)) {
            $transition = CompanyTransition::tryFrom($transition);
        }

        return $transition instanceof CompanyTransition && $transition->requiresReason();
    }
}
