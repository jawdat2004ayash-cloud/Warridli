<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListAuditLogsRequest;
use App\Http\Resources\Admin\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;

/**
 * Admin only — `admin` middleware on the route group. Read-only: there is no endpoint that edits or deletes
 * audit entries. Newest first, 30 per page.
 */
class AuditLogController extends Controller
{
    public function index(ListAuditLogsRequest $request): AnonymousResourceCollection
    {
        $group = $request->string('group')->value();
        $actor = $request->string('actor')->value();
        $subjectType = $request->string('subject_type')->value();
        // Damascus calendar days → UTC instants (D6b).
        $from = $request->filled('from') ? Carbon::parse($request->string('from')->value(), 'Asia/Damascus')->startOfDay()->utc() : null;
        $to = $request->filled('to') ? Carbon::parse($request->string('to')->value(), 'Asia/Damascus')->endOfDay()->utc() : null;

        $logs = AuditLog::query()
            ->with(['actor', 'subject'])
            ->when($group !== '', fn ($q) => $q->where('action', 'like', addcslashes($group, '\\%_').'.%'))
            ->when($actor === 'system', fn ($q) => $q->whereNull('actor_user_id'))
            ->when($actor === 'admin', fn ($q) => $q->whereHas('actor', fn ($user) => $user->where('is_admin', true)))
            ->when($subjectType !== '', fn ($q) => $q->where('subject_type', $subjectType)->where('subject_id', $request->integer('subject_id')))
            ->when($from !== null, fn ($q) => $q->where('created_at', '>=', $from))
            ->when($to !== null, fn ($q) => $q->where('created_at', '<=', $to))
            ->orderByDesc('id')
            ->paginate(30)
            ->withQueryString();

        return AuditLogResource::collection($logs);
    }
}
