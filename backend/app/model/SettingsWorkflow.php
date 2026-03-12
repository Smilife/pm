<?php

declare(strict_types=1);

namespace app\model;

use think\Model;

final class SettingsWorkflow extends Model
{
    protected $name = 'settings_workflows';

    protected $pk = 'id';

    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
        'enabled' => 'boolean',
    ];
}