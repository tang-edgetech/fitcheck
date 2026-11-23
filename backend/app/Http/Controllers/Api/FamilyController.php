<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Family;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Families are the tabs on the tester. Each has an ordered list of screen views. */
class FamilyController extends Controller
{
    public function index(): JsonResponse
    {
        $families = Family::query()->orderBy('sort_order')->orderBy('id')
            ->with('screenViews:id,name,brand,type,width,height,is_active')
            ->get()
            ->map(fn (Family $f) => array_merge($f->toArray(), [
                'screen_view_ids' => $f->screenViews->pluck('id'),
                'screen_views_count' => $f->screenViews->count(),
            ]));

        return response()->json(['data' => $families]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $family = DB::transaction(function () use ($data, $request) {
            $data['slug'] = $data['slug'] ?? $this->uniqueSlug($data['name']);
            $data['sort_order'] = $data['sort_order'] ?? (Family::query()->max('sort_order') + 1);
            $family = Family::query()->create($data);
            $this->syncViews($family, $request->input('screen_view_ids', []));
            $this->onlyOneDefault($family);

            return $family;
        });
        PublicController::bust();
        $this->audit($request, 'families.create', $family, null);

        return response()->json($family, 201);
    }

    public function update(Request $request, Family $family): JsonResponse
    {
        $before = $this->snapshot($family);
        $data = $this->validated($request, $family);
        DB::transaction(function () use ($family, $data, $request) {
            $family->fill($data)->save();
            if ($request->has('screen_view_ids')) {
                $this->syncViews($family, $request->input('screen_view_ids', []));
            }
            $this->onlyOneDefault($family);
        });
        PublicController::bust();
        $this->audit($request, 'families.update', $family, $before);

        return response()->json($family);
    }

    public function destroy(Request $request, Family $family): JsonResponse
    {
        $before = $this->snapshot($family);
        $family->delete();
        PublicController::bust();
        $request->attributes->set('audit', ['action' => 'families.delete', 'target' => ['type' => 'family', 'id' => $family->id, 'label' => $family->name], 'meta' => ['before' => $before]]);

        return response()->json(['ok' => true]);
    }

    /** Save tab order: ids in the order they should appear. */
    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate(['ids' => ['required', 'array'], 'ids.*' => ['integer', 'exists:families,id']]);
        DB::transaction(function () use ($data) {
            foreach ($data['ids'] as $i => $id) {
                Family::query()->whereKey($id)->update(['sort_order' => $i + 1]);
            }
        });
        PublicController::bust();
        $request->attributes->set('audit', ['action' => 'families.reorder', 'meta' => ['order' => $data['ids']]]);

        return response()->json(['ok' => true]);
    }

    private function validated(Request $request, ?Family $f = null): array
    {
        $req = $f ? 'sometimes' : 'required';

        return $request->validate([
            'slug' => ['nullable', 'string', 'max:60', 'alpha_dash', Rule::unique('families', 'slug')->ignore($f?->id)],
            'name' => [$req, 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'between:0,100000'],
            'screen_view_ids' => ['sometimes', 'array', 'max:200'],
            'screen_view_ids.*' => ['integer', 'distinct', 'exists:screen_views,id'],
        ]);
    }

    private function syncViews(Family $family, array $ids): void
    {
        $family->screenViews()->sync(collect($ids)->values()->mapWithKeys(fn ($id, $i) => [(int) $id => ['sort_order' => $i + 1]])->all());
    }

    private function onlyOneDefault(Family $family): void
    {
        if ($family->is_default) {
            Family::query()->whereKeyNot($family->id)->update(['is_default' => false]);
        }
    }

    private function snapshot(Family $f): array
    {
        return $f->only(['slug', 'name', 'description', 'is_active', 'is_default', 'sort_order']) + ['screen_view_ids' => $f->screenViews()->pluck('screen_views.id')->all()];
    }

    private function audit(Request $request, string $action, Family $family, ?array $before): void
    {
        $request->attributes->set('audit', ['action' => $action, 'target' => ['type' => 'family', 'id' => $family->id, 'label' => $family->name],
            'meta' => array_filter(['before' => $before, 'after' => $this->snapshot($family->fresh())])]);
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'family';
        $slug = $base;
        $i = 2;
        while (Family::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
