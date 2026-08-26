<?php

require __DIR__ . '/vendor/autoload.php';

use Albert\Core\Kernel;
use Albert\Database\Connection;
use Albert\Database\Model;
use Albert\Http\Middleware\AddHeaderMiddleware;
use Albert\View\View;
use Dotenv\Dotenv;

if (file_exists(__DIR__ . '/.env')) {
    Dotenv::createImmutable(__DIR__)->safeLoad();
}

$kernel = new Kernel();
$container = $kernel->container();

$view = new View(__DIR__ . '/resources/views', getenv('APP_DEBUG') === 'true');
$container->instance(View::class, $view);

$connection = Connection::fromEnv(__DIR__);
$container->instance(\Doctrine\DBAL\Connection::class, $connection);
Model::setConnection($connection);

$kernel->pushMiddleware(new AddHeaderMiddleware());

(require __DIR__ . '/routes/web.php')($kernel->router());

return $kernel;
