<?php

namespace App\Actions\Admin;

use App\Models\Category;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Categories are data (D25): an admin adds, renames, reorders and (de)activates them. There is no delete —
 * RFQs and supplier specialties keep pointing at their category (FKs restrict). Deactivating only hides it from
 * new RFQs, new specialty requests and triage; existing RFQs and approved specialties are untouched (D36).
 */
class SaveCategory
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array{name_ar: string, sort?: int|null}  $data
     */
    public function create(array $data, User $admin): Category
    {
        return DB::transaction(function () use ($data, $admin) {
            $category = new Category;
            $category->forceFill([
                // Stable technical key; Arabic names don't transliterate reliably and names may change.
                'slug' => 'c-'.Str::lower((string) Str::ulid()),
                'name_ar' => $data['name_ar'],
                'sort' => $data['sort'] ?? $this->nextSort(),
                'is_active' => true,
            ])->save();

            $this->audit->record('category.created', $category, ['name' => $category->name_ar, 'sort' => $category->sort], $admin);

            return $category;
        });
    }

    /**
     * @param  array{name_ar?: string, sort?: int|null, is_active?: bool}  $data
     */
    public function update(Category $category, array $data, User $admin): Category
    {
        DB::transaction(function () use ($category, $data, $admin) {
            /** @var Category $locked */
            $locked = Category::query()->whereKey($category->id)->lockForUpdate()->firstOrFail();
            $before = ['name_ar' => $locked->name_ar, 'sort' => $locked->sort, 'is_active' => $locked->is_active];

            $locked->forceFill(array_intersect_key($data, $before))->save();
            $changed = array_keys($locked->getChanges());
            $changed = array_values(array_diff($changed, ['updated_at']));

            if ($changed === []) {
                return; // nothing to record (e.g. a double click)
            }

            $action = $changed === ['is_active']
                ? ($locked->is_active ? 'category.activated' : 'category.deactivated')
                : 'category.updated';

            $this->audit->record($action, $locked, [
                'changed' => implode(',', $changed),
                'name_from' => in_array('name_ar', $changed, true) ? $before['name_ar'] : null,
                'name' => $locked->name_ar,
                'is_active' => $locked->is_active,
            ], $admin);
        });

        return $category->refresh();
    }

    private function nextSort(): int
    {
        return min(9990, (int) Category::query()->max('sort') + 10);
    }
}
