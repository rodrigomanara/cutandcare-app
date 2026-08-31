<?php

use Albert\App\Http\Controllers\HomeController;
use Albert\Core\Http\Router;

return function (Router $router): void {
    $router->get('/', [HomeController::class, 'index'], 'home');
    $router->get('/hello/{name}', [HomeController::class, 'hello'], 'hello');
};
