<?php

namespace Albert\App\Http\Controllers;

use Albert\Core\Http\Request;
use Albert\Core\Http\Response;
use Albert\Core\View\View;

readonly class HomeController
{
    public function __construct(private View $view)
    {
    }

    public function index(Request $request): Response
    {

        $data = $request->request->all();
        ;

        return new Response(json_encode($data));

    }

    public function hello(Request $request): Response
    {
        $name = $request->attributes->get('name', 'stranger');

        return new Response("Hello, {$name}!");
    }
}
