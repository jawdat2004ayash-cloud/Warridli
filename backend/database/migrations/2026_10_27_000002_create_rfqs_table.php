<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations. D1: one part per RFQ, so the part fields live on the RFQ itself.
     * Columns for later milestones (selected_quote_id, triaged_by/at) are added by their own migrations.
     */
    public function up(): void
    {
        Schema::create('rfqs', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('buyer_company_id')->constrained('companies')->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            // NULL = the buyer chose "I don't know the category" → pending_review (admin triage).
            $table->foreignId('category_id')->nullable()->constrained('categories')->restrictOnDelete();
            $table->enum('status', ['pending_review', 'open', 'closed', 'cancelled', 'expired', 'rejected']);
            $table->text('description');
            $table->string('part_number', 100)->nullable();
            $table->string('machine_make', 100)->nullable();
            $table->string('machine_model', 100)->nullable();
            $table->unsignedInteger('quantity');
            $table->enum('unit', ['piece', 'set', 'meter']);
            $table->foreignId('area_id')->constrained('areas')->restrictOnDelete();
            $table->enum('urgency', ['normal', 'urgent', 'line_stopped']);
            $table->timestamp('closes_at');
            $table->timestamps();

            // Supplier inbox / admin triage queue (M3b, M4a) and the buyer's own list.
            $table->index(['status', 'category_id', 'created_at']);
            $table->index(['buyer_company_id', 'created_at']);
        });

        DB::statement('ALTER TABLE rfqs ADD CONSTRAINT rfqs_quantity_positive CHECK (quantity > 0)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rfqs');
    }
};
