<?php

namespace Albert\Core;

use Closure;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionNamedType;
use ReflectionParameter;
use RuntimeException;

class Container implements ContainerInterface
{
    private array $bindings = [];

    private array $instances = [];

    public function bind(string $abstract, Closure|string|null $concrete = null): void
    {
        $this->bindings[$abstract] = [
            'concrete' => $concrete ?? $abstract,
            'shared' => false,
        ];
    }

    public function singleton(string $abstract, Closure|string|null $concrete = null): void
    {
        $this->bindings[$abstract] = [
            'concrete' => $concrete ?? $abstract,
            'shared' => true,
        ];
    }

    public function instance(string $abstract, object $instance): void
    {
        $this->instances[$abstract] = $instance;
    }

    public function has(string $id): bool
    {
        return isset($this->instances[$id]) || isset($this->bindings[$id]) || class_exists($id);
    }

    public function get(string $id): mixed
    {
        return $this->resolve($id);
    }

    public function resolve(string $abstract): mixed
    {
        if (isset($this->instances[$abstract])) {
            return $this->instances[$abstract];
        }

        $concrete = $this->bindings[$abstract]['concrete'] ?? $abstract;
        $shared = $this->bindings[$abstract]['shared'] ?? false;

        $object = $concrete instanceof Closure
            ? $concrete($this)
            : $this->build($concrete);

        if ($shared) {
            $this->instances[$abstract] = $object;
        }

        return $object;
    }

    private function build(string $concrete): object
    {
        if (!class_exists($concrete)) {
            throw new RuntimeException("Target class [$concrete] does not exist.");
        }

        $reflector = new ReflectionClass($concrete);

        if (!$reflector->isInstantiable()) {
            throw new RuntimeException("Target [$concrete] is not instantiable.");
        }

        $constructor = $reflector->getConstructor();

        if ($constructor === null) {
            return new $concrete();
        }

        $dependencies = array_map(
            fn (ReflectionParameter $parameter) => $this->resolveParameter($parameter),
            $constructor->getParameters()
        );

        return $reflector->newInstanceArgs($dependencies);
    }

    private function resolveParameter(ReflectionParameter $parameter): mixed
    {
        $type = $parameter->getType();

        if ($type instanceof ReflectionNamedType && !$type->isBuiltin()) {
            return $this->resolve($type->getName());
        }

        if ($parameter->isDefaultValueAvailable()) {
            return $parameter->getDefaultValue();
        }

        $declaringClass = $parameter->getDeclaringClass()?->getName();

        throw new RuntimeException(
            "Unable to resolve dependency [\${$parameter->getName()}] in class [{$declaringClass}]."
        );
    }
}
