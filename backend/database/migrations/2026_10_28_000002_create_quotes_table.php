<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations. One quote per supplier company per RFQ (unique) — edits update the same row (D11).
     */
    public function up(): void
    {
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rfq_id')->constrained('rfqs')->cascadeOnDelete();
            $table->foreignId('supplier_company_id')->constrained('companies')->restrictOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->restrictOnDelete();
            $table->decimal('unit_price', 14, 2);
            $table->enum('currency', ['SYP', 'USD']);
            $table->enum('condition', ['new', 'used', 'refurbished']);
            $table->string('brand', 100)->nullable();
            $table->string('origin', 100)->nullable();
            $table->enum('stock_status', ['in_stock', 'on_order']);
            $table->unsignedSmallInteger('lead_time_days');
            $table->enum('fulfillment', ['pickup', 'supplier_delivery', 'either']);
            $table->date('valid_until');
            $table->string('notes', 1000)->nullable();
            $table->enum('status', ['submitted', 'withdrawn']);
            $table->timestamps();

            $table->unique(['rfq_id', 'supplier_company_id']);
            $table->index(['supplier_company_id', 'created_at']);
        });

        DB::statement('ALTER TABLE quotes ADD CONSTRAINT quotes_unit_price_positive CHECK (unit_price > 0)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quotes');
    }
};
