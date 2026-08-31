<?php

namespace Albert\Core\Http;



class Router
{
    /** @var Route[] */
    private array $routes = [];

    public function get(string $uri, callable|array $action, ?string $name = null): Route
    {
        return $this->addRoute('GET', $uri, $action, $name);
    }

    public function post(string $uri, callable|array $action, ?string $name = null): Route
    {
        return $this->addRoute('POST', $uri, $action, $name);
    }

    public function put(string $uri, callable|array $action, ?string $name = null): Route
    {
        return $this->addRoute('PUT', $uri, $action, $name);
    }

    public function patch(string $uri, callable|array $action, ?string $name = null): Route
    {
        return $this->addRoute('PATCH', $uri, $action, $name);
    }

    public function delete(string $uri, callable|array $action, ?string $name = null): Route
    {
        return $this->addRoute('DELETE', $uri, $action, $name);
    }

    private function addRoute(string $method, string $uri, callable|array $action, ?string $name): Route
    {
        $route = new Route($method, $uri, $action, $name);
        $this->routes[] = $route;

        return $route;
    }

    /** @return Route[] */
    public function all(): array
    {
        return $this->routes;
    }

    public function match(Request $request): ?Route
    {
        $method = $request->getMethod();
        $path = $request->getPathInfo();
        $path = $path === '/' ? '/' : rtrim($path, '/');

        foreach ($this->routes as $route) {
            if ($route->method() !== $method) {
                continue;
            }

            $parameters = $route->matches($path);

            if ($parameters !== null) {
                $route->bindParameters($parameters);

                return $route;
            }
        }

        return null;
    }
}
