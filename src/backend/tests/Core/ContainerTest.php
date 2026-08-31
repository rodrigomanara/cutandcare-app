<?php

namespace Albert\backend\tests\Core;

use Albert\backend\Core\Container;
use PHPUnit\Framework\TestCase;

class ContainerTest extends TestCase
{
    public function test_it_autowires_typed_constructor_dependencies(): void
    {
        $container = new Container();

        $bar = $container->get(Bar::class);

        $this->assertInstanceOf(Bar::class, $bar);
        $this->assertInstanceOf(Foo::class, $bar->foo);
    }

    public function test_singleton_returns_the_same_instance(): void
    {
        $container = new Container();
        $container->singleton(Foo::class);

        $this->assertSame($container->get(Foo::class), $container->get(Foo::class));
    }

    public function test_bind_returns_a_fresh_instance_each_time(): void
    {
        $container = new Container();
        $container->bind(Foo::class);

        $this->assertNotSame($container->get(Foo::class), $container->get(Foo::class));
    }

    public function test_instance_registers_a_pre_built_object(): void
    {
        $container = new Container();
        $foo = new Foo();
        $container->instance(Foo::class, $foo);

        $this->assertSame($foo, $container->get(Foo::class));
    }
}

class Foo
{
}

class Bar
{
    public function __construct(public Foo $foo)
    {
    }
}
