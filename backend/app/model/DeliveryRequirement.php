<?php

declare(strict_types=1);

namespace app\model;

use think\Model;

final class DeliveryRequirement extends Model
{
    protected $name = 'delivery_requirements';

    protected $pk = 'id';

    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
    ];
}