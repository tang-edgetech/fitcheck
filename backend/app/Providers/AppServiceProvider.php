<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Every permission in config/fitcheck.php becomes a Gate ability checked by role.
        foreach (config('fitcheck.all_permissions') as $ability) {
            Gate::define($ability, fn (User $user) => $user->is_active && in_array($ability, $user->permissions(), true));
        }
    }
}
