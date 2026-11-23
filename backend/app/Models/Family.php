<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Family extends Model
{
    protected $fillable = ['slug', 'name', 'description', 'is_active', 'is_default', 'sort_order'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'is_default' => 'boolean', 'sort_order' => 'integer'];
    }

    public function screenViews(): BelongsToMany
    {
        return $this->belongsToMany(ScreenView::class)->withPivot('sort_order')->orderByPivot('sort_order');
    }
}
