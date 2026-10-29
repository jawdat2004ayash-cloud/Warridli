<?php

namespace App\Console\Commands;

use App\Actions\Rfqs\ExpireRfqs;
use Illuminate\Console\Command;

/**
 * Runs every 15 minutes via the scheduler (routes/console.php). Until it runs, closes_at is already enforced at
 * read/write time (Rfq::acceptsQuotes), so a late run never lets a quote in after the deadline.
 */
class ExpireRfqsCommand extends Command
{
    protected $signature = 'warridli:expire-rfqs';

    protected $description = 'Mark open RFQs whose answer window has passed as expired (audited)';

    public function handle(ExpireRfqs $action): int
    {
        $this->info('Expired RFQs: '.$action->handle());

        return self::SUCCESS;
    }
}
