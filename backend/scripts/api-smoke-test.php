<?php

declare(strict_types=1);

$baseUrl = $argv[1] ?? 'http://127.0.0.1:8000/api/v1';

function apiRequest(string $method, string $url, ?array $payload = null, array $headers = []): array
{
    $headerLines = [
        'Content-Type: application/json',
    ];
    foreach ($headers as $key => $value) {
        $headerLines[] = $key . ': ' . $value;
    }

    $context = stream_context_create([
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headerLines),
            'content' => $payload === null ? '' : json_encode($payload, JSON_UNESCAPED_UNICODE),
            'ignore_errors' => true,
            'timeout' => 10,
        ],
    ]);

    $body = file_get_contents($url, false, $context);
    $statusLine = $http_response_header[0] ?? 'HTTP/1.1 500 Internal Server Error';
    preg_match('/\s(\d{3})\s/', $statusLine, $matches);
    $status = (int) ($matches[1] ?? 500);
    $decoded = is_string($body) ? json_decode($body, true) : null;

    return [
        'status' => $status,
        'body' => is_array($decoded) ? $decoded : ['raw' => $body],
    ];
}

$login = apiRequest('POST', $baseUrl . '/auth/login', [
    'account' => 'wangjun@example.com',
    'password' => 'demo123',
]);
if (($login['status'] ?? 500) !== 200) {
    fwrite(STDERR, json_encode(['step' => 'login', 'result' => $login], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL);
    exit(1);
}

$token = (string) (($login['body']['data']['token'] ?? ''));
$authHeaders = ['Authorization' => 'Bearer ' . $token];
$checks = [
    'projects' => apiRequest('GET', $baseUrl . '/projects', null, $authHeaders),
    'requirements' => apiRequest('GET', $baseUrl . '/requirements', null, $authHeaders),
    'executions' => apiRequest('GET', $baseUrl . '/executions', null, $authHeaders),
    'worklogs' => apiRequest('GET', $baseUrl . '/worklogs', null, $authHeaders),
    'daily_tasks' => apiRequest('GET', $baseUrl . '/daily-tasks', null, $authHeaders),
    'bugs' => apiRequest('GET', $baseUrl . '/bugs', null, $authHeaders),
    'policies' => apiRequest('GET', $baseUrl . '/settings/policies', null, $authHeaders),
    'project_gantt' => apiRequest('GET', $baseUrl . '/schedules/project-gantt', null, $authHeaders),
    'team_gantt' => apiRequest('GET', $baseUrl . '/schedules/team-gantt', null, $authHeaders),
    'execution_gantt' => apiRequest('GET', $baseUrl . '/schedules/execution-gantt', null, $authHeaders),
];

$summary = [];
foreach ($checks as $name => $result) {
    if (($result['status'] ?? 500) !== 200) {
        fwrite(STDERR, json_encode(['step' => $name, 'result' => $result], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL);
        exit(1);
    }

    $summary[$name] = [
        'status' => $result['status'],
        'total' => $result['body']['data']['total'] ?? null,
    ];
}

echo json_encode([
    'base_url' => $baseUrl,
    'login_status' => $login['status'],
    'checks' => $summary,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
