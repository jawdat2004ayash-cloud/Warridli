<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations. Who decided an "unknown category" RFQ (M4a): set its category (→ open) or rejected it.
     * Additive and nullable: existing rows stay as they are.
     */
    public function up(): void
    {
        Schema::table('rfqs', function (Blueprint $table) {
            $table->foreignId('triaged_by')->nullable()->after('selected_quote_id')->constrained('users')->nullOnDelete();
            $table->timestamp('triaged_at')->nullable()->after('triaged_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rfqs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('triaged_by');
            $table->dropColumn('triaged_at');
        });
    }
};
