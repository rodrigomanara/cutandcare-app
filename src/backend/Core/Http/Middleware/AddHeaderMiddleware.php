<?php

namespace Albert\Core\Http\Middleware;

use Albert\Core\Http\MiddlewareInterface;
use Closure;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

class AddHeaderMiddleware implements MiddlewareInterface
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $response->headers->set('X-Powered-By', 'Albert');

        return $response;
    }
}
