<?php

namespace Database\Seeders;

use App\Models\Family;
use App\Models\ScreenView;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Log;

/**
 * Safe to run on every build or deploy (php artisan db:seed --force):
 * creates what is missing and never overwrites changes made in the admin panel.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->accounts();
        $this->settings();
        $this->screenViews();
        $this->families();
    }

    private function accounts(): void
    {
        foreach (config('fitcheck.seed_accounts') as $a) {
            $user = User::query()->firstOrNew(['username' => $a['username']]);
            if (! $user->exists) {
                $user->fill(['role' => $a['role'], 'password' => config('fitcheck.default_password'), 'is_active' => true, 'must_change_password' => true])->save();
                $this->command?->info("Created account {$a['username']} ({$a['role']}). It must change the default password on first sign-in.");
                Log::info("Seeded default account {$a['username']}");
            }
        }
    }

    private function settings(): void
    {
        foreach (config('fitcheck.settings') as $key => $value) {
            Setting::query()->firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }

    /** [slug, name, width, height, type, frame, brand] in CSS pixels */
    public const CATALOG = [
        ['ip17pm', 'iPhone 17 Pro Max', 440, 956, 'Mobile', 'island', 'Apple'],
        ['ip17p', 'iPhone 17 Pro', 402, 874, 'Mobile', 'island', 'Apple'],
        ['ipair', 'iPhone Air', 420, 912, 'Mobile', 'island', 'Apple'],
        ['ip17', 'iPhone 17', 402, 874, 'Mobile', 'island', 'Apple'],
        ['ip16e', 'iPhone 16e', 390, 844, 'Mobile', 'notch', 'Apple'],
        ['ip15', 'iPhone 15', 393, 852, 'Mobile', 'island', 'Apple'],
        ['ipse', 'iPhone SE', 375, 667, 'Mobile', 'home', 'Apple'],
        ['s25u', 'Galaxy S25 Ultra', 412, 891, 'Mobile', 'hole', 'Samsung'],
        ['s25p', 'Galaxy S25+', 384, 832, 'Mobile', 'hole', 'Samsung'],
        ['s25', 'Galaxy S25', 360, 780, 'Mobile', 'hole', 'Samsung'],
        ['a56', 'Galaxy A56', 384, 854, 'Mobile', 'hole', 'Samsung'],
        ['flip7', 'Galaxy Z Flip7', 412, 1004, 'Mobile', 'hole', 'Samsung'],
        ['px10px', 'Pixel 10 Pro XL', 412, 921, 'Mobile', 'hole', 'Google'],
        ['px10', 'Pixel 10', 412, 915, 'Mobile', 'hole', 'Google'],
        ['px9a', 'Pixel 9a', 412, 892, 'Mobile', 'hole', 'Google'],
        ['mi15', 'Xiaomi 15', 393, 851, 'Mobile', 'hole', 'Xiaomi'],
        ['rn14', 'Redmi Note 14 Pro', 393, 873, 'Mobile', 'hole', 'Xiaomi'],
        ['op13', 'OnePlus 13', 412, 915, 'Mobile', 'hole', 'OnePlus'],
        ['findx8', 'Oppo Find X8 Pro', 412, 915, 'Mobile', 'hole', 'Oppo'],
        ['vx200', 'Vivo X200 Pro', 412, 915, 'Mobile', 'hole', 'Vivo'],
        ['mag8p', 'Honor Magic8 Pro', 412, 916, 'Mobile', 'hole', 'Honor'],
        ['mag7l', 'Honor Magic7 Lite', 400, 888, 'Mobile', 'hole', 'Honor'],
        ['p70', 'Huawei Pura 70 Pro', 412, 915, 'Mobile', 'hole', 'Huawei'],
        ['ipmini', 'iPad mini', 744, 1133, 'Tablet', 'tablet', 'Apple'],
        ['ipad', 'iPad 11"', 820, 1180, 'Tablet', 'tablet', 'Apple'],
        ['ipair13', 'iPad Air 13"', 1024, 1366, 'Tablet', 'tablet', 'Apple'],
        ['tabs10', 'Galaxy Tab S10', 800, 1280, 'Tablet', 'tablet', 'Samsung'],
        ['fold7', 'Galaxy Z Fold7 (open)', 884, 1104, 'Tablet', 'tablet', 'Samsung'],
        ['magv5', 'Honor Magic V5 (open)', 800, 868, 'Tablet', 'tablet', 'Honor'],
        ['lap1024', 'Small laptop', 1024, 600, 'Desktop', 'browser', 'Laptop'],
        ['lap1280', 'Laptop', 1280, 800, 'Desktop', 'browser', 'Laptop'],
        ['lap1366', 'Laptop HD', 1366, 768, 'Desktop', 'browser', 'Laptop'],
        ['lap1440', 'Laptop 1440', 1440, 900, 'Desktop', 'browser', 'Laptop'],
        ['fhd', 'Desktop Full HD', 1920, 1080, 'Desktop', 'browser', 'Desktop'],
        ['qhd', 'Desktop QHD', 2560, 1440, 'Desktop', 'browser', 'Desktop'],
        ['tv720', 'TV 720p', 1280, 720, 'TV', 'tv', 'TV'],
        ['tv1080', 'TV 1080p', 1920, 1080, 'TV', 'tv', 'TV'],
        ['tv4k', 'TV 4K', 3840, 2160, 'TV', 'tv', 'TV'],
    ];

    private function screenViews(): void
    {
        foreach (self::CATALOG as $i => [$slug, $name, $w, $h, $type, $frame, $brand]) {
            ScreenView::query()->firstOrCreate(['slug' => $slug], [
                'name' => $name, 'width' => $w, 'height' => $h, 'type' => $type, 'frame' => $frame, 'brand' => $brand,
                'is_active' => true, 'sort_order' => ($i + 1) * 10,
            ]);
        }
    }

    private function families(): void
    {
        $byType = fn (string $type, ?callable $f = null) => collect(self::CATALOG)->filter(fn ($d) => $d[4] === $type && (! $f || $f($d)))->pluck(0)->all();
        $families = [
            ['popular', 'Popular', true, ['ip17pm', 'ip17p', 'ip16e', 'ipse', 's25u', 's25', 'px10', 'a56', 'rn14']],
            ['iphone', 'iPhone', false, $byType('Mobile', fn ($d) => $d[6] === 'Apple')],
            ['galaxy', 'Galaxy', false, $byType('Mobile', fn ($d) => $d[6] === 'Samsung')],
            ['pixel', 'Pixel', false, $byType('Mobile', fn ($d) => $d[6] === 'Google')],
            ['more-android', 'More Android', false, $byType('Mobile', fn ($d) => ! in_array($d[6], ['Apple', 'Samsung', 'Google'], true))],
            ['tablets', 'Tablets', false, $byType('Tablet')],
            ['laptops', 'Laptops & desktops', false, $byType('Desktop')],
            ['tv', 'TV', false, $byType('TV')],
        ];
        foreach ($families as $i => [$slug, $name, $default, $slugs]) {
            $family = Family::query()->firstOrNew(['slug' => $slug]);
            if ($family->exists) {
                continue; // keep whatever was changed in the admin panel
            }
            $family->fill(['name' => $name, 'is_default' => $default, 'is_active' => true, 'sort_order' => $i + 1])->save();
            $ids = ScreenView::query()->whereIn('slug', $slugs)->pluck('id', 'slug');
            $family->screenViews()->sync(collect($slugs)->filter(fn ($s) => isset($ids[$s]))->values()
                ->mapWithKeys(fn ($s, $n) => [$ids[$s] => ['sort_order' => $n + 1]])->all());
        }
    }
}
