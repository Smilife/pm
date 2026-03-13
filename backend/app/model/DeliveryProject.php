<?php

declare(strict_types=1);

namespace app\model;

use think\Model;

final class DeliveryProject extends Model
{
    protected $name = 'delivery_projects';

    protected $pk = 'id';

    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
        'risk_count' => 'integer',
        'execution_count' => 'integer',
    ];
}