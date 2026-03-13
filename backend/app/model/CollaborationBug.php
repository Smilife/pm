<?php

declare(strict_types=1);

namespace app\model;

use think\Model;

final class CollaborationBug extends Model
{
    protected $name = 'collaboration_bugs';

    protected $pk = 'id';

    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
        'link_id' => 'integer',
    ];
}