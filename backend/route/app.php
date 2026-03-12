<?php

declare(strict_types=1);

use App\Support\ThinkBridge;
use think\Request;
use think\facade\Route;

Route::post('api/v1/auth/login', 'AuthApiController/login')->completeMatch(true);
Route::post('api/v1/auth/logout', 'AuthApiController/logout')->completeMatch(true);
Route::get('api/v1/auth/me', 'AuthApiController/me')->completeMatch(true);
Route::get('api/v1/auth/permissions', 'AuthApiController/permissions')->completeMatch(true);
Route::get('api/v1/system/summary', 'SystemApiController/summary')->completeMatch(true);
Route::get('api/v1/performance/members', 'PerformanceApiController/members')->completeMatch(true);

Route::post('api/v1/requirements/batch-generate-executions', 'RequirementApiController/batchGenerateExecutions')->completeMatch(true);
Route::post('api/v1/requirements/batch-generate-tasks', 'RequirementApiController/batchGenerateTasks')->completeMatch(true);
Route::get('api/v1/requirements', 'RequirementApiController/index')->completeMatch(true);
Route::post('api/v1/requirements', 'RequirementApiController/store')->completeMatch(true);
Route::post('api/v1/requirements/<id>/attachments', 'RequirementApiController/storeAttachment')->pattern(['id' => '\d+'])->completeMatch(true);
Route::post('api/v1/requirements/<id>/actions/submit-review', 'RequirementApiController/submitForReview')->pattern(['id' => '\d+'])->completeMatch(true);
Route::post('api/v1/requirements/<id>/reviews', 'RequirementApiController/storeReview')->pattern(['id' => '\d+'])->completeMatch(true);
Route::get('api/v1/requirements/<id>/reviews', 'RequirementApiController/listReviews')->pattern(['id' => '\d+'])->completeMatch(true);
Route::get('api/v1/requirements/<id>', 'RequirementApiController/show')->pattern(['id' => '\d+'])->completeMatch(true);
Route::patch('api/v1/requirements/<id>', 'RequirementApiController/update')->pattern(['id' => '\d+'])->completeMatch(true);

Route::get('api/v1/projects', 'ProjectApiController/index')->completeMatch(true);
Route::post('api/v1/projects', 'ProjectApiController/store')->completeMatch(true);
Route::get('api/v1/projects/<id>', 'ProjectApiController/show')->pattern(['id' => '\d+'])->completeMatch(true);
Route::patch('api/v1/projects/<id>', 'ProjectApiController/update')->pattern(['id' => '\d+'])->completeMatch(true);

Route::get('api/v1/executions', 'ExecutionApiController/index')->completeMatch(true);
Route::post('api/v1/executions', 'ExecutionApiController/store')->completeMatch(true);
Route::get('api/v1/executions/<id>/tasks', 'ExecutionApiController/listTasks')->pattern(['id' => '\d+'])->completeMatch(true);
Route::get('api/v1/executions/<id>/worklogs', 'WorklogApiController/listByExecution')->pattern(['id' => '\d+'])->completeMatch(true);
Route::get('api/v1/executions/<id>', 'ExecutionApiController/show')->pattern(['id' => '\d+'])->completeMatch(true);
Route::patch('api/v1/executions/<id>', 'ExecutionApiController/update')->pattern(['id' => '\d+'])->completeMatch(true);

Route::get('api/v1/tasks', 'ExecutionApiController/taskIndex')->completeMatch(true);
Route::post('api/v1/tasks', 'ExecutionApiController/taskStore')->completeMatch(true);
Route::get('api/v1/tasks/<id>', 'ExecutionApiController/taskShow')->pattern(['id' => '\d+'])->completeMatch(true);
Route::patch('api/v1/tasks/<id>', 'ExecutionApiController/taskUpdate')->pattern(['id' => '\d+'])->completeMatch(true);

Route::get('api/v1/worklogs', 'WorklogApiController/index')->completeMatch(true);
Route::post('api/v1/worklogs', 'WorklogApiController/store')->completeMatch(true);
Route::get('api/v1/worklogs/<id>', 'WorklogApiController/show')->pattern(['id' => '\d+'])->completeMatch(true);
Route::patch('api/v1/worklogs/<id>', 'WorklogApiController/update')->pattern(['id' => '\d+'])->completeMatch(true);

Route::get('api/v1/schedules/team-gantt', 'ScheduleApiController/teamGantt')->completeMatch(true);
Route::get('api/v1/schedules/execution-gantt', 'ScheduleApiController/executionGantt')->completeMatch(true);

Route::post('api/v1/reports/daily/generate', 'ReportApiController/generateDaily')->completeMatch(true);
Route::post('api/v1/reports/weekly/generate', 'ReportApiController/generateWeekly')->completeMatch(true);

Route::rule('api/v1', static function (Request $request) {
    return ThinkBridge::dispatch($request);
}, '*')->completeMatch(true);

Route::rule('api/v1/<path>', static function (Request $request, string $path) {
    return ThinkBridge::dispatch($request);
}, '*')->pattern([
    'path' => '.+',
])->completeMatch(true);