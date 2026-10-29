<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations. The quote the buyer chose when closing the RFQ (M3c). That it belongs to the same RFQ
     * is enforced in App\Actions\Rfqs\SelectQuote (row-locked) and covered by tests (ERD).
     */
    public function up(): void
    {
        Schema::table('rfqs', function (Blueprint $table) {
            $table->foreignId('selected_quote_id')->nullable()->after('closes_at')->constrained('quotes')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rfqs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('selected_quote_id');
        });
    }
};
