<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations. Laravel's standard database-notifications shape (A4) plus `dedupe_key`: one row per
     * recipient per event, enforced by the database, so a retried action can never notify twice (D39).
     */
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type', 64);
            $table->string('notifiable_type', 32);
            $table->unsignedBigInteger('notifiable_id');
            $table->string('dedupe_key', 120);
            $table->json('data');
            $table->timestamp('read_at')->nullable();
            // Microseconds: several events in one second still list in the order they happened.
            $table->timestamps(precision: 6);

            $table->unique(['notifiable_type', 'notifiable_id', 'dedupe_key']);
            // Recipient's list (newest first) and unread count.
            $table->index(['notifiable_type', 'notifiable_id', 'created_at']);
            $table->index(['notifiable_type', 'notifiable_id', 'read_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
