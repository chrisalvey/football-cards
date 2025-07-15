<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT');
header('Access-Control-Allow-Headers: Content-Type');

$dataFile = 'shared-data.json';

// Create file if it doesn't exist
if (!file_exists($dataFile)) {
    $defaultData = [
        'players' => new stdClass(),
        'hands' => new stdClass(),
        'messages' => [],
        'gameActive' => true,
        'lastUpdated' => time() * 1000
    ];
    file_put_contents($dataFile, json_encode($defaultData));
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Read data
    $data = file_get_contents($dataFile);
    echo $data;
    
} else if ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'PUT') {
    // Write data
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if ($data) {
        $data['lastUpdated'] = time() * 1000;
        file_put_contents($dataFile, json_encode($data));
        echo json_encode(['success' => true]);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
    }
}
?>
