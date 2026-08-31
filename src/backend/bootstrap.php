<?php

require __DIR__ . '/vendor/autoload.php';

use Albert\Core\Database\Connection;
use Albert\Core\Database\Model;
use Albert\Core\Http\Middleware\AddHeaderMiddleware;
use Albert\Core\Kernel;
use Albert\Core\View\View;
use Dotenv\Dotenv;

if (file_exists(__DIR__ . '/.env')) {
    Dotenv::createImmutable(__DIR__)->safeLoad();
}

$kernel = new Kernel();
$container = $kernel->container();

$view = new View(__DIR__ . '/App/resources/views', getenv('APP_DEBUG') === 'true');
$container->instance(View::class, $view);

$connection = Connection::fromEnv(__DIR__);
$container->instance(\Doctrine\DBAL\Connection::class, $connection);
Model::setConnection($connection);

$kernel->pushMiddleware(new AddHeaderMiddleware());

(require __DIR__ . '/App/routes/web.php')($kernel->router());

$kernel->run();
