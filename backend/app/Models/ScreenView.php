<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ScreenView extends Model
{
    protected $fillable = ['slug', 'name', 'brand', 'type', 'width', 'height', 'frame', 'is_active', 'sort_order'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'width' => 'integer', 'height' => 'integer', 'sort_order' => 'integer'];
    }

    public function families(): BelongsToMany
    {
        return $this->belongsToMany(Family::class)->withPivot('sort_order');
    }

    /** Shape the tester needs (keys match the frontend's Device type). */
    public function toPublic(): array
    {
        return [
            'id' => $this->slug,
            'name' => $this->name,
            'brand' => $this->brand,
            'type' => $this->type,
            'w' => $this->width,
            'h' => $this->height,
            'shape' => $this->frame,
        ];
    }
}
