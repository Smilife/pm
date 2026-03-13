<?php

declare(strict_types=1);

namespace app\model;

use think\Model;

final class CollaborationWorklog extends Model
{
    protected $name = 'collaboration_worklogs';

    protected $pk = 'id';

    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
        'execution_id' => 'integer',
    ];
}