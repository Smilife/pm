<?php

declare(strict_types=1);

namespace app\model;

use think\Model;

final class SettingsDictionary extends Model
{
    protected $name = 'settings_dictionaries';

    protected $pk = 'id';

    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
    ];
}