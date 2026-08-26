<?php

namespace Albert\Core;

class EventListener
{
    private array $listeners = [];

    public function listen(string $event, callable $listener): void
    {
        $this->listeners[$event][] = $listener;
    }

    public function dispatch(string $event, mixed ...$payload): array
    {
        $results = [];

        foreach ($this->listeners[$event] ?? [] as $listener) {
            $results[] = $listener(...$payload);
        }

        return $results;
    }

    public function forget(string $event): void
    {
        unset($this->listeners[$event]);
    }

    public function hasListeners(string $event): bool
    {
        return !empty($this->listeners[$event]);
    }
}
