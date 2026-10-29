<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// D34: open RFQs past closes_at → expired. Needs `php artisan schedule:work` (dev) / a cron for `schedule:run` (prod).
Schedule::command('warridli:expire-rfqs')->everyFifteenMinutes()->withoutOverlapping();

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
