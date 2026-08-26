<?php

namespace Albert\Http;

class Route
{
    private array $parameters = [];

    private array $middleware = [];

    public function __construct(
        private readonly string $method,
        private readonly string $uri,
        private readonly mixed $action,
        private readonly ?string $name = null,
    ) {
    }

    public function method(): string
    {
        return $this->method;
    }

    public function uri(): string
    {
        return $this->uri;
    }

    public function name(): ?string
    {
        return $this->name;
    }

    public function action(): mixed
    {
        return $this->action;
    }

    public function parameters(): array
    {
        return $this->parameters;
    }

    public function middleware(array|string $middleware): self
    {
        $this->middleware = array_merge($this->middleware, (array) $middleware);

        return $this;
    }

    public function middlewares(): array
    {
        return $this->middleware;
    }

    /**
     * Returns matched parameters keyed by name, or null if the path doesn't match this route.
     */
    public function matches(string $path): ?array
    {
        $uri = $this->uri === '/' ? '/' : rtrim($this->uri, '/');
        $pattern = preg_replace('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', '(?P<$1>[^/]+)', $uri);
        $pattern = '#^' . $pattern . '$#';

        if (!preg_match($pattern, $path, $matches)) {
            return null;
        }

        return array_filter($matches, fn ($key) => is_string($key), ARRAY_FILTER_USE_KEY);
    }

    public function bindParameters(array $parameters): void
    {
        $this->parameters = $parameters;
    }
}
