<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'username', 'email', 'display_name', 'password', 'role', 'is_active', 'must_change_password',
    ];

    protected $hidden = [
        'password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'must_change_password' => 'boolean',
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'encrypted:array',
            'two_factor_confirmed_at' => 'datetime',
            'password_changed_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    public function isDeveloper(): bool
    {
        return $this->role === 'developer';
    }

    public function hasTwoFactor(): bool
    {
        return $this->two_factor_secret !== null && $this->two_factor_confirmed_at !== null;
    }

    public function needsProfile(): bool
    {
        return blank($this->email) || blank($this->display_name);
    }

    public function permissions(): array
    {
        $perms = config("fitcheck.permissions.{$this->role}", []);

        return in_array('*', $perms, true) ? config('fitcheck.all_permissions') : $perms;
    }

    public function label(): string
    {
        return $this->display_name ?: $this->username;
    }
}
