<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed reference data only. No user accounts are seeded (admins: php artisan warridli:create-admin).
     */
    public function run(): void
    {
        $this->call([AreaSeeder::class, CategorySeeder::class]);
    }
}
