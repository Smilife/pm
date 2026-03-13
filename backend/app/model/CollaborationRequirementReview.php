<?php

declare(strict_types=1);

namespace app\model;

use think\Model;

final class CollaborationRequirementReview extends Model
{
    protected $name = 'collaboration_requirement_reviews';

    protected $pk = 'id';

    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
        'requirement_id' => 'integer',
    ];
}