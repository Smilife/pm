<?php

declare(strict_types=1);

namespace app\model;

use think\Model;

final class DeliveryExecution extends Model
{
    protected $name = 'delivery_executions';

    protected $pk = 'id';

    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
        'project_id' => 'integer',
        'plan_progress' => 'integer',
        'actual_progress' => 'integer',
    ];
}