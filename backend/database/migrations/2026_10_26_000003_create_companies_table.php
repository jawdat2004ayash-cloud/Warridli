<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['buyer', 'supplier']);
            $table->string('name', 150);
            // E.164, e.g. +9639XXXXXXXX (normalized server-side).
            $table->string('whatsapp_phone', 20);
            $table->foreignId('area_id')->constrained('areas')->restrictOnDelete();
            $table->string('address_text', 255)->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'suspended']);
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->index(['type', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
