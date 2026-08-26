<?php

namespace App\Http\Controllers;

use Albert\View\View;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

class HomeController
{
    public function __construct(private readonly View $view)
    {
    }

    public function index(Request $request): Response
    {
        return new Response($this->view->render('welcome.twig', ['name' => 'World']));
    }

    public function hello(Request $request): Response
    {
        $name = $request->attributes->get('name', 'stranger');

        return new Response("Hello, {$name}!");
    }
}
