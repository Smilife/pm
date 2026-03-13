<?php

declare(strict_types=1);

return [
    app\middleware\ApiRequestContextMiddleware::class,
    app\middleware\ApiAuthenticationMiddleware::class,
    app\middleware\ApiAuthorizationMiddleware::class,
];