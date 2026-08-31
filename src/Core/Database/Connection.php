<?php

namespace Albert\Core\Database;

use Doctrine\DBAL\Connection as DbalConnection;
use Doctrine\DBAL\DriverManager;

class Connection
{
    public static function fromEnv(string $basePath): DbalConnection
    {
        $driver = self::env('DB_CONNECTION', 'sqlite');

        if ($driver === 'sqlite') {
            $path = self::env('DB_DATABASE', 'storage/database.sqlite');

            if (!str_starts_with($path, '/')) {
                $path = rtrim($basePath, '/') . '/' . $path;
            }

            if (!is_dir(dirname($path))) {
                mkdir(dirname($path), 0755, true);
            }

            return DriverManager::getConnection(['driver' => 'pdo_sqlite', 'path' => $path]);
        }

        return DriverManager::getConnection([
            'driver' => self::env('DB_DRIVER', 'pdo_mysql'),
            'host' => self::env('DB_HOST', '127.0.0.1'),
            'port' => (int) self::env('DB_PORT', 3306),
            'dbname' => self::env('DB_DATABASE', 'albert'),
            'user' => self::env('DB_USERNAME', 'root'),
            'password' => self::env('DB_PASSWORD', ''),
        ]);
    }

    private static function env(string $key, mixed $default = null): mixed
    {
        $value = getenv($key);

        return $value === false ? $default : $value;
    }
}
