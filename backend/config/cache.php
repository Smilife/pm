<?php

declare(strict_types=1);

return [
    'default' => 'file',
    'stores' => [
        'file' => [
            'type' => 'File',
            'path' => dirname(__DIR__) . '/storage/framework/cache/',
            'prefix' => 'pm_',
            'expire' => 0,
        ],
    ],
];