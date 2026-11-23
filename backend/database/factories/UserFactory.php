<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<User> */
class UserFactory extends Factory
{
    public function definition(): array
    {
        return [
            'username' => Str::lower(fake()->unique()->userName()),
            'email' => fake()->unique()->safeEmail(),
            'display_name' => fake()->name(),
            'password' => 'Secret@1234',
            'role' => 'admin',
            'is_active' => true,
            'must_change_password' => false,
        ];
    }
}
