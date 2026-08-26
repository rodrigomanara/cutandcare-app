<?php

namespace Albert\Tests\Core;

use Albert\Core\EventListener;
use PHPUnit\Framework\TestCase;

class EventListenerTest extends TestCase
{
    public function test_it_dispatches_to_all_listeners_and_collects_results(): void
    {
        $events = new EventListener();
        $events->listen('greet', fn (string $name) => "Hello, {$name}!");
        $events->listen('greet', fn (string $name) => strtoupper($name));

        $results = $events->dispatch('greet', 'World');

        $this->assertSame(['Hello, World!', 'WORLD'], $results);
    }

    public function test_dispatching_an_event_with_no_listeners_returns_an_empty_array(): void
    {
        $events = new EventListener();

        $this->assertSame([], $events->dispatch('unknown'));
    }

    public function test_forget_removes_all_listeners_for_an_event(): void
    {
        $events = new EventListener();
        $events->listen('greet', fn () => 'hi');
        $events->forget('greet');

        $this->assertFalse($events->hasListeners('greet'));
        $this->assertSame([], $events->dispatch('greet'));
    }
}
