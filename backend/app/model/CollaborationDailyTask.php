<?php

declare(strict_types=1);

namespace app\model;

use think\Model;

final class CollaborationDailyTask extends Model
{
    protected $name = 'collaboration_daily_tasks';

    protected $pk = 'id';

    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
        'exclude_from_report' => 'boolean',
    ];
}