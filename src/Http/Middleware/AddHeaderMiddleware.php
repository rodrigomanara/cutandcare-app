<?php

namespace Albert\Http\Middleware;

use Albert\Http\MiddlewareInterface;
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
