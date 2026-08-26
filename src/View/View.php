<?php

namespace Albert\View;

use Twig\Environment;
use Twig\Loader\FilesystemLoader;

class View
{
    private Environment $twig;

    public function __construct(string $viewsPath, bool $debug = false)
    {
        $loader = new FilesystemLoader($viewsPath);
        $this->twig = new Environment($loader, ['debug' => $debug]);
    }

    public function render(string $template, array $data = []): string
    {
        return $this->twig->render($template, $data);
    }

    public function environment(): Environment
    {
        return $this->twig;
    }
}
