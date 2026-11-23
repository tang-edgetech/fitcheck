<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private const SHOWN = ['id', 'username', 'email', 'display_name', 'role', 'is_active', 'must_change_password', 'two_factor_confirmed_at', 'last_login_at', 'last_login_ip', 'created_at'];

    public function index(Request $request): JsonResponse
    {
        $q = User::query()->select(self::SHOWN);
        if ($s = trim((string) $request->query('q'))) {
            $q->where(fn ($w) => $w->where('username', 'like', "%{$s}%")->orWhere('email', 'like', "%{$s}%")->orWhere('display_name', 'like', "%{$s}%"));
        }
        if ($r = $request->query('role')) {
            $q->where('role', $r);
        }
        if ($request->filled('active')) {
            $q->where('is_active', filter_var($request->query('active'), FILTER_VALIDATE_BOOL));
        }

        return response()->json(['data' => $q->orderBy('username')->get(), 'roles' => config('fitcheck.roles')]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'min:3', 'max:50', 'alpha_dash', 'unique:users,username'],
            'email' => ['nullable', 'email:rfc', 'max:255', 'unique:users,email'],
            'display_name' => ['nullable', 'string', 'max:100'],
            'role' => ['required', Rule::in(array_keys(config('fitcheck.roles')))],
        ]);
        $this->guardRole($request, $data['role']);
        $temp = $this->tempPassword();
        $user = User::query()->create($data + ['password' => $temp, 'must_change_password' => true, 'is_active' => true]);
        $this->audit($request, 'users.create', $user, null, $user->only(['username', 'email', 'display_name', 'role']));

        return response()->json(['user' => $user->only(self::SHOWN), 'temporary_password' => $temp], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->guardTarget($request, $user);
        $data = $request->validate([
            'email' => ['nullable', 'email:rfc', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'display_name' => ['nullable', 'string', 'max:100'],
            'role' => ['sometimes', Rule::in(array_keys(config('fitcheck.roles')))],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if (isset($data['role'])) {
            $this->guardRole($request, $data['role']);
        }
        if ($user->is($request->user()) && ((isset($data['role']) && $data['role'] !== $user->role) || (isset($data['is_active']) && ! $data['is_active']))) {
            abort(422, 'You cannot change your own role or disable your own account.');
        }
        $this->guardLastDeveloper($user, $data);
        $before = $user->only(['email', 'display_name', 'role', 'is_active']);
        $user->fill($data)->save();
        if (isset($data['is_active']) && ! $data['is_active']) {
            DB::table('sessions')->where('user_id', $user->id)->delete();
        }
        $this->audit($request, 'users.update', $user, $before, $user->only(['email', 'display_name', 'role', 'is_active']));

        return response()->json($user->only(self::SHOWN));
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $this->guardTarget($request, $user);
        $temp = $this->tempPassword();
        $user->forceFill(['password' => $temp, 'must_change_password' => true])->save();
        DB::table('sessions')->where('user_id', $user->id)->delete();
        $this->audit($request, 'users.reset_password', $user, null, null);

        return response()->json(['temporary_password' => $temp]);
    }

    public function resetTwoFactor(Request $request, User $user): JsonResponse
    {
        $this->guardTarget($request, $user);
        $user->forceFill(['two_factor_secret' => null, 'two_factor_recovery_codes' => null, 'two_factor_confirmed_at' => null])->save();
        $this->audit($request, 'users.reset_two_factor', $user, null, null);

        return response()->json($user->only(self::SHOWN));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->guardTarget($request, $user);
        abort_if($user->is($request->user()), 422, 'You cannot delete your own account.');
        $this->guardLastDeveloper($user, ['is_active' => false]);
        $before = $user->only(['username', 'email', 'display_name', 'role']);
        DB::table('sessions')->where('user_id', $user->id)->delete();
        $user->delete();
        $this->audit($request, 'users.delete', $user, $before, null);

        return response()->json(['ok' => true]);
    }

    /** Admins cannot manage Developer accounts. */
    private function guardTarget(Request $request, User $target): void
    {
        abort_if($target->isDeveloper() && ! $request->user()->isDeveloper(), 403, 'Only a Developer can change a Developer account.');
    }

    private function guardRole(Request $request, string $role): void
    {
        abort_if($role === 'developer' && ! $request->user()->isDeveloper(), 403, 'Only a Developer can give the Developer role.');
    }

    private function guardLastDeveloper(User $user, array $data): void
    {
        $losing = $user->isDeveloper() && ((isset($data['role']) && $data['role'] !== 'developer') || (isset($data['is_active']) && ! $data['is_active']));
        if ($losing && User::query()->where('role', 'developer')->where('is_active', true)->whereKeyNot($user->id)->doesntExist()) {
            abort(422, 'At least one active Developer account must remain.');
        }
    }

    /** Meets the password policy: upper, lower, digit and symbol. */
    private function tempPassword(): string
    {
        return Str::password(8, true, false, false).'-'.random_int(10, 99).'A!b';
    }

    private function audit(Request $request, string $action, User $user, ?array $before, ?array $after): void
    {
        $request->attributes->set('audit', ['action' => $action, 'target' => ['type' => 'user', 'id' => $user->id, 'label' => $user->username],
            'meta' => array_filter(['before' => $before, 'after' => $after], fn ($v) => $v !== null)]);
    }
}
