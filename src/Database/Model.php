<?php

namespace Albert\Database;

use Doctrine\DBAL\Connection as DbalConnection;
use RuntimeException;

abstract class Model
{
    protected static ?DbalConnection $connection = null;

    protected static string $table;

    protected static string $primaryKey = 'id';

    public array $attributes;

    public function __construct(array $attributes = [])
    {
        $this->attributes = $attributes;
    }

    public static function setConnection(DbalConnection $connection): void
    {
        static::$connection = $connection;
    }

    protected static function connection(): DbalConnection
    {
        if (static::$connection === null) {
            throw new RuntimeException('No database connection has been set. Call Model::setConnection() first.');
        }

        return static::$connection;
    }

    /** @return static[] */
    public static function all(): array
    {
        $rows = static::connection()->fetchAllAssociative('SELECT * FROM ' . static::$table);

        return array_map(fn (array $row) => new static($row), $rows);
    }

    public static function find(int|string $id): ?static
    {
        $row = static::connection()->fetchAssociative(
            'SELECT * FROM ' . static::$table . ' WHERE ' . static::$primaryKey . ' = ?',
            [$id]
        );

        return $row === false ? null : new static($row);
    }

    /** @return static[] */
    public static function where(string $column, mixed $value): array
    {
        $rows = static::connection()->fetchAllAssociative(
            'SELECT * FROM ' . static::$table . ' WHERE ' . $column . ' = ?',
            [$value]
        );

        return array_map(fn (array $row) => new static($row), $rows);
    }

    public static function create(array $attributes): static
    {
        static::connection()->insert(static::$table, $attributes);

        return static::find((int) static::connection()->lastInsertId()) ?? new static($attributes);
    }

    public function save(): void
    {
        $primaryKey = static::$primaryKey;

        if (isset($this->attributes[$primaryKey])) {
            $id = $this->attributes[$primaryKey];
            $data = $this->attributes;
            unset($data[$primaryKey]);
            static::connection()->update(static::$table, $data, [$primaryKey => $id]);

            return;
        }

        static::connection()->insert(static::$table, $this->attributes);
        $this->attributes[$primaryKey] = (int) static::connection()->lastInsertId();
    }

    public function delete(): void
    {
        static::connection()->delete(static::$table, [static::$primaryKey => $this->attributes[static::$primaryKey]]);
    }

    public function __get(string $name): mixed
    {
        return $this->attributes[$name] ?? null;
    }

    public function __set(string $name, mixed $value): void
    {
        $this->attributes[$name] = $value;
    }
}
