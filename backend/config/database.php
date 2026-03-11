<?php

declare(strict_types=1);

return [
    'default' => 'sqlite',
    'cache_store' => 'file',
    'connections' => [
        'sqlite' => [
            'type' => 'sqlite',
            'database' => dirname(__DIR__) . '/storage/framework/thinkphp.sqlite',
            'prefix' => '',
        ],
    ],
];