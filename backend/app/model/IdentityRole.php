<?php

declare(strict_types=1);

namespace app\model;

use think\Model;

final class IdentityRole extends Model
{
    protected $name = 'identity_roles';

    protected $pk = 'id';

    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
    ];
}