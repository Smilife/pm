<?php

declare(strict_types=1);

namespace App;

use App\Support\DatabaseMaintenance;
use App\Support\StoreRegistry;
use think\Service;

final class AppService extends Service
{
    public function register(): void
    {
        $this->app->instance(StoreRegistry::class, new StoreRegistry());
        $this->app->instance(DatabaseMaintenance::class, new DatabaseMaintenance());
    }
}