<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ScreenView;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ScreenViewController extends Controller
{
    private const FIELDS = ['slug', 'name', 'brand', 'type', 'width', 'height', 'frame', 'is_active', 'sort_order'];

    public function index(Request $request): JsonResponse
    {
        $q = ScreenView::query()->withCount('families')->with('families:id,name');
        if ($s = trim((string) $request->query('q'))) {
            $q->where(fn ($w) => $w->where('name', 'like', "%{$s}%")->orWhere('brand', 'like', "%{$s}%")->orWhere('slug', 'like', "%{$s}%")
                ->orWhere('width', (int) $s ?: -1));
        }
        foreach (['type', 'brand', 'frame'] as $f) {
            if ($v = $request->query($f)) {
                $q->whereIn($f, (array) $v);
            }
        }
        if ($request->filled('active')) {
            $q->where('is_active', filter_var($request->query('active'), FILTER_VALIDATE_BOOL));
        }
        $sort = in_array($request->query('sort'), ['name', 'brand', 'type', 'width', 'height', 'updated_at', 'sort_order'], true) ? $request->query('sort') : 'sort_order';
        $dir = $request->query('dir') === 'desc' ? 'desc' : 'asc';
        $q->orderBy($sort, $dir)->orderBy('id');

        $page = $q->paginate(min(200, max(5, (int) $request->query('per_page', 50))));

        return response()->json([
            'data' => $page->items(),
            'total' => $page->total(),
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'brands' => ScreenView::query()->distinct()->orderBy('brand')->pluck('brand'),
            'types' => config('fitcheck.device_types'),
            'frames' => config('fitcheck.frames'),
        ]);
    }

    public function show(ScreenView $screenView): JsonResponse
    {
        return response()->json($screenView->load('families:id,name'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['slug'] = $data['slug'] ?? $this->uniqueSlug($data['name']);
        $sv = DB::transaction(function () use ($data, $request) {
            $sv = new ScreenView($data);
            $sv->forceFill(['created_by' => $request->user()->id, 'updated_by' => $request->user()->id])->save();
            if ($request->has('family_ids')) {
                $sv->families()->sync($this->familySync($sv, $request->input('family_ids', [])));
            }

            return $sv;
        });
        PublicController::bust();
        $this->audit($request, 'screenviews.create', $sv, null, $sv->only(self::FIELDS));

        return response()->json($sv->load('families:id,name'), 201);
    }

    public function update(Request $request, ScreenView $screenView): JsonResponse
    {
        $before = $screenView->only(self::FIELDS);
        $data = $this->validated($request, $screenView);
        DB::transaction(function () use ($screenView, $data, $request) {
            $screenView->fill($data)->forceFill(['updated_by' => $request->user()->id])->save();
            if ($request->has('family_ids')) {
                $screenView->families()->sync($this->familySync($screenView, $request->input('family_ids', [])));
            }
        });
        PublicController::bust();
        $this->audit($request, 'screenviews.update', $screenView, $before, $screenView->only(self::FIELDS));

        return response()->json($screenView->load('families:id,name'));
    }

    public function destroy(Request $request, ScreenView $screenView): JsonResponse
    {
        $before = $screenView->only(self::FIELDS);
        $screenView->delete();
        PublicController::bust();
        $this->audit($request, 'screenviews.delete', $screenView, $before, null);

        return response()->json(['ok' => true]);
    }

    /** Bulk activate / deactivate / delete. */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['activate', 'deactivate', 'delete'])],
            'ids' => ['required', 'array', 'min:1', 'max:500'],
            'ids.*' => ['integer', 'exists:screen_views,id'],
        ]);
        $q = ScreenView::query()->whereIn('id', $data['ids']);
        $names = $q->pluck('name')->all();
        match ($data['action']) {
            'activate' => $q->update(['is_active' => true, 'updated_by' => $request->user()->id]),
            'deactivate' => $q->update(['is_active' => false, 'updated_by' => $request->user()->id]),
            'delete' => $q->delete(),
        };
        PublicController::bust();
        $request->attributes->set('audit', ['action' => 'screenviews.bulk_'.$data['action'],
            'target' => ['type' => 'screen_view', 'id' => implode(',', $data['ids']), 'label' => count($names).' screen views'],
            'meta' => ['ids' => $data['ids'], 'names' => $names]]);

        return response()->json(['ok' => true, 'count' => count($names)]);
    }

    /** The built-in device library (database/data/device-library.php), each marked with whether it's already added. */
    public function library(): JsonResponse
    {
        $existing = ScreenView::query()->pluck('slug')->flip();
        $devices = collect(static::libraryData())->map(fn ($d) => [
            'slug' => $d[0], 'name' => $d[1], 'brand' => $d[2], 'type' => $d[3],
            'width' => $d[4], 'height' => $d[5], 'frame' => $d[6], 'year' => $d[7],
            'added' => $existing->has($d[0]),
        ])->values();

        return response()->json(['data' => $devices, 'total' => $devices->count(), 'added' => $devices->where('added', true)->count()]);
    }

    /** Adds the chosen library devices as screen views (skipping ones that exist) and puts them in the chosen menu groups. */
    public function import(Request $request): JsonResponse
    {
        $library = collect(static::libraryData())->keyBy(0);
        $data = $request->validate([
            'slugs' => ['required', 'array', 'min:1', 'max:300'],
            'slugs.*' => ['string', Rule::in($library->keys()->all())],
            'family_ids' => ['sometimes', 'array'],
            'family_ids.*' => ['integer', 'exists:families,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $existing = ScreenView::query()->whereIn('slug', $data['slugs'])->pluck('slug')->all();
        $new = array_values(array_diff(array_unique($data['slugs']), $existing));
        $order = (int) ScreenView::query()->max('sort_order');

        $created = DB::transaction(function () use ($new, $library, $data, $request, &$order) {
            $created = [];
            foreach ($new as $slug) {
                [, $name, $brand, $type, $w, $h, $frame] = $library[$slug];
                $sv = new ScreenView(['slug' => $slug, 'name' => $name, 'brand' => $brand, 'type' => $type, 'width' => $w, 'height' => $h,
                    'frame' => $frame, 'is_active' => $data['is_active'] ?? true, 'sort_order' => $order += 10]);
                $sv->forceFill(['created_by' => $request->user()->id, 'updated_by' => $request->user()->id])->save();
                if (! empty($data['family_ids'])) {
                    $sv->families()->sync($this->familySync($sv, $data['family_ids']));
                }
                $created[] = $sv;
            }

            return $created;
        });
        PublicController::bust();
        $names = array_map(fn ($sv) => $sv->name, $created);
        $request->attributes->set('audit', ['action' => 'screenviews.import',
            'target' => ['type' => 'screen_view', 'label' => count($created).' screen views'],
            'meta' => ['added' => $names, 'skipped_existing' => $existing, 'family_ids' => $data['family_ids'] ?? []]]);

        return response()->json(['added' => count($created), 'skipped' => count($existing), 'names' => $names], 201);
    }

    private static function libraryData(): array
    {
        return require database_path('data/device-library.php');
    }

    private function validated(Request $request, ?ScreenView $sv = null): array
    {
        $req = $sv ? 'sometimes' : 'required';

        return $request->validate([
            'slug' => ['nullable', 'string', 'max:60', 'alpha_dash', Rule::unique('screen_views', 'slug')->ignore($sv?->id)],
            'name' => [$req, 'string', 'max:100'],
            'brand' => [$req, 'string', 'max:60'],
            'type' => [$req, Rule::in(config('fitcheck.device_types'))],
            'width' => [$req, 'integer', 'between:200,4000'],
            'height' => [$req, 'integer', 'between:200,4000'],
            'frame' => [$req, Rule::in(config('fitcheck.frames'))],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'between:0,100000'],
            'family_ids' => ['sometimes', 'array'],
            'family_ids.*' => ['integer', 'exists:families,id'],
        ]);
    }

    private function familySync(ScreenView $sv, array $ids): array
    {
        // keep the current position in families it already belongs to; new memberships go to the end
        $current = $sv->families()->pluck('family_screen_view.sort_order', 'families.id')->all();

        return collect($ids)->mapWithKeys(fn ($id) => [(int) $id => ['sort_order' => $current[(int) $id] ?? 100000]])->all();
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'screen';
        $slug = $base;
        $i = 2;
        while (ScreenView::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    private function audit(Request $request, string $action, ScreenView $sv, ?array $before, ?array $after): void
    {
        $request->attributes->set('audit', ['action' => $action,
            'target' => ['type' => 'screen_view', 'id' => $sv->id, 'label' => $sv->name],
            'meta' => array_filter(['before' => $before, 'after' => $after], fn ($v) => $v !== null)]);
    }
}
