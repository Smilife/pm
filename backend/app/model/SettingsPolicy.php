<?php

declare(strict_types=1);

namespace app\model;

use think\Model;

final class SettingsPolicy extends Model
{
    protected $name = 'settings_policies';

    protected $pk = 'id';

    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
    ];
}