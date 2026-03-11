<?php

declare(strict_types=1);

use App\Support\ThinkBridge;
use think\Request;
use think\facade\Route;

Route::rule('api/v1', static function (Request $request) {
    return ThinkBridge::dispatch($request);
}, '*');

Route::rule('api/v1/<path>', static function (Request $request, string $path) {
    return ThinkBridge::dispatch($request);
}, '*')->pattern([
    'path' => '.+',
]);
