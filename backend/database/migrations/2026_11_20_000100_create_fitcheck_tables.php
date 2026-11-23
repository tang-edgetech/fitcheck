<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->json('value')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // A "screen view" is one device viewport the tester can show.
        Schema::create('screen_views', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 60)->unique();
            $table->string('name', 100);
            $table->string('brand', 60)->index();
            $table->string('type', 20)->index();            // Mobile | Tablet | Desktop | TV
            $table->unsignedSmallInteger('width');           // CSS px
            $table->unsignedSmallInteger('height');          // CSS px
            $table->string('frame', 20)->default('none');    // island | notch | hole | home | tablet | browser | tv | none
            $table->boolean('is_active')->default(true)->index();
            $table->unsignedInteger('sort_order')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // A "family" is a tab on the tester (Popular, iPhone, Tablets…) with an ordered list of screen views.
        Schema::create('families', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 60)->unique();
            $table->string('name', 80);
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('family_screen_view', function (Blueprint $table) {
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('screen_view_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->primary(['family_id', 'screen_view_id']);
        });

        // Append-only. Each row stores a hash of the previous row so tampering is detectable.
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('username', 100)->nullable()->index();
            $table->string('action', 100)->index();
            $table->string('status', 10)->index();           // success | failed
            $table->string('target_type', 60)->nullable();
            $table->string('target_id', 60)->nullable();
            $table->string('target_label')->nullable();
            $table->string('method', 10)->nullable();
            $table->string('path')->nullable();
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->json('meta')->nullable();
            $table->char('prev_hash', 64)->nullable();
            $table->char('hash', 64);
            $table->timestamp('created_at')->useCurrent()->index();
        });

        Schema::create('system_logs', function (Blueprint $table) {
            $table->id();
            $table->string('level', 20)->index();
            $table->string('channel', 40)->nullable();
            $table->text('message');
            $table->json('context')->nullable();
            $table->string('request_id', 40)->nullable();
            $table->string('url')->nullable();
            $table->string('ip', 45)->nullable();
            $table->foreignId('user_id')->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_logs');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('family_screen_view');
        Schema::dropIfExists('families');
        Schema::dropIfExists('screen_views');
        Schema::dropIfExists('settings');
    }
};
