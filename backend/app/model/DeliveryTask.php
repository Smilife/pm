<?php

declare(strict_types=1);

namespace app\model;

use think\Model;

final class DeliveryTask extends Model
{
    protected $name = 'delivery_tasks';

    protected $pk = 'id';

    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
        'execution_id' => 'integer',
        'actual_progress' => 'integer',
    ];
}