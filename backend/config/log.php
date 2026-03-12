<?php

declare(strict_types=1);

return [
    'default' => 'file',
    'channels' => [
        'file' => [
            'type' => 'File',
            'path' => dirname(__DIR__) . '/runtime/log',
            'single' => false,
            'apart_level' => [],
            'max_files' => 30,
            'time_format' => 'Y-m-d H:i:s',
            'format' => '[%s][%s] %s',
            'realtime_write' => false,
        ],
    ],
];