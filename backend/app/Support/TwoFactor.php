<?php

namespace App\Support;

use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

/** TOTP (RFC 6238) helpers: secrets, QR codes, verification with replay protection, recovery codes. */
class TwoFactor
{
    public function __construct(private Google2FA $engine = new Google2FA) {}

    public function newSecret(): string
    {
        return $this->engine->generateSecretKey(32);
    }

    public function otpauthUrl(User $user, string $secret): string
    {
        return $this->engine->getQRCodeUrl(config('app.name', 'Fitcheck'), $user->email ?: $user->username, $secret);
    }

    public function qrSvg(string $url): string
    {
        $writer = new Writer(new ImageRenderer(new RendererStyle(200, 1), new SvgImageBackEnd));

        return $writer->writeString($url);
    }

    /** Accepts the current code (±30 s) once; the same time step cannot be reused. */
    public function verify(User $user, string $secret, string $code): bool
    {
        $code = preg_replace('/\s+/', '', $code);
        if (! preg_match('/^\d{6}$/', $code)) {
            return false;
        }
        $key = "2fa.last_ts.{$user->id}";
        $last = Cache::get($key);
        $ts = $this->engine->verifyKeyNewer($secret, $code, $last, 1);
        if ($ts === false) {
            return false;
        }
        Cache::put($key, $ts === true ? $this->engine->getTimestamp() : $ts, now()->addMinutes(5));

        return true;
    }

    /** Consumes a recovery code if it matches. */
    public function useRecoveryCode(User $user, string $code): bool
    {
        $code = strtoupper(trim($code));
        $codes = $user->two_factor_recovery_codes ?? [];
        foreach ($codes as $i => $hashed) {
            if (hash_equals($hashed, hash('sha256', $code))) {
                unset($codes[$i]);
                $user->forceFill(['two_factor_recovery_codes' => array_values($codes)])->save();

                return true;
            }
        }

        return false;
    }

    /** Returns plain codes to show once; stores only their hashes. */
    public function newRecoveryCodes(User $user): array
    {
        $plain = collect(range(1, 8))->map(fn () => Str::upper(Str::random(5).'-'.Str::random(5)))->all();
        $user->forceFill(['two_factor_recovery_codes' => array_map(fn ($c) => hash('sha256', $c), $plain)])->save();

        return $plain;
    }
}
