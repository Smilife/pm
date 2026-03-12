<?php

declare(strict_types=1);

namespace app\model;

use think\Model;

final class IdentityUser extends Model
{
    protected $name = 'identity_users';

    protected $pk = 'id';

    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
        'dingtalk_bound' => 'boolean',
    ];
}