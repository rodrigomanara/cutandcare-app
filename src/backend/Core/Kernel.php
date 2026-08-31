<?php

namespace Albert\Core;

use Albert\Core\Container;
use Albert\Core\EventListener;
use Albert\Core\Http\MiddlewareInterface;
use Albert\Core\Http\Request;
use Albert\Core\Http\Response;
use Albert\Core\Http\Router;
use Closure;
use Throwable;

class Kernel
{
    private Container $container;

    private EventListener $events;

    private Router $router;

    /** @var array<int, MiddlewareInterface|string> */
    private array $middleware = [];

    public function __construct(?Container $container = null, ?EventListener $events = null, ?Router $router = null)
    {
        $this->container = $container ?? new Container();
        $this->events = $events ?? new EventListener();
        $this->router = $router ?? new Router();

        $this->container->instance(Container::class, $this->container);
        $this->container->instance(EventListener::class, $this->events);
        $this->container->instance(Router::class, $this->router);
        $this->container->instance(self::class, $this);
    }

    public function container(): Container
    {
        return $this->container;
    }

    public function events(): EventListener
    {
        return $this->events;
    }

    public function router(): Router
    {
        return $this->router;
    }

    public function pushMiddleware(MiddlewareInterface|string $middleware): void
    {
        $this->middleware[] = $middleware;
    }

    public function handle(Request $request): Response
    {
        $this->events->dispatch('kernel.handling', $request);

        try {
            $response = $this->dispatch($request);
        } catch (Throwable $exception) {
            $this->events->dispatch('kernel.exception', $request, $exception);
            $response = $this->renderException($exception);
        }

        $this->events->dispatch('kernel.handled', $request, $response);

        return $response;
    }

    public function run(): void
    {
        $request = Request::createFromGlobals();
        $response = $this->handle($request);
        $response->send();
    }

    private function dispatch(Request $request): Response
    {
        $route = $this->router->match($request);

        if ($route === null) {
            return new Response('Not Found', Response::HTTP_NOT_FOUND);
        }

        $request->attributes->add($route->parameters());

        $middleware = array_merge($this->middleware, $route->middlewares());
        $destination = fn (Request $request): Response => $this->callAction($route->action(), $request);

        return $this->runMiddleware($request, $middleware, $destination);
    }

    private function runMiddleware(Request $request, array $middleware, Closure $destination): Response
    {
        $resolve = function (Closure $next, MiddlewareInterface|string $middleware) {
            return function (Request $request) use ($next, $middleware): Response {
                $instance = is_string($middleware) ? $this->container->get($middleware) : $middleware;

                return $instance->handle($request, $next);
            };
        };

        $pipeline = array_reduce(array_reverse($middleware), $resolve, $destination);

        return $pipeline($request);
    }

    private function callAction(mixed $action, Request $request): Response
    {
        if (is_array($action)) {
            [$class, $method] = $action;
            $result = $this->container->get($class)->$method($request);
        } else {
            $result = $action($request);
        }

        return $result instanceof Response ? $result : new Response((string) $result);
    }

    private function renderException(Throwable $exception): Response
    {
        $debug = getenv('APP_DEBUG') === 'true';
        $message = $debug ? $exception->getMessage() : 'Internal Server Error';

        return new Response($message, Response::HTTP_INTERNAL_SERVER_ERROR);
    }
}
