<?php

namespace Albert\Tests\Http;

use Albert\Core\Http\Router;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;

class RouterTest extends TestCase
{
    public function test_it_matches_a_static_route(): void
    {
        $router = new Router();
        $route = $router->get('/', fn () => 'home');

        $matched = $router->match(Request::create('/'));

        $this->assertSame($route, $matched);
    }

    public function test_it_extracts_route_parameters(): void
    {
        $router = new Router();
        $router->get('/hello/{name}', fn () => 'hi');

        $matched = $router->match(Request::create('/hello/Rodrigo'));

        $this->assertNotNull($matched);
        $this->assertSame(['name' => 'Rodrigo'], $matched->parameters());
    }

    public function test_it_returns_null_when_nothing_matches(): void
    {
        $router = new Router();
        $router->get('/', fn () => 'home');

        $this->assertNull($router->match(Request::create('/missing')));
    }

    public function test_it_does_not_match_a_different_http_method(): void
    {
        $router = new Router();
        $router->post('/posts', fn () => 'store');

        $this->assertNull($router->match(Request::create('/posts', 'GET')));
    }
}
