<?php

namespace Albert\Core\View;

use Twig\Environment;
use Twig\Error\LoaderError;
use Twig\Error\RuntimeError;
use Twig\Error\SyntaxError;
use Twig\Loader\FilesystemLoader;

class View
{
    private Environment $twig;

    /**
     * @param string $viewsPath
     * @param bool $debug
     */
    public function __construct(string $viewsPath, bool $debug = false)
    {
        $loader = new FilesystemLoader($viewsPath);
        $this->twig = new Environment($loader, ['debug' => $debug]);
    }

    /**
     * @throws SyntaxError
     * @throws RuntimeError
     * @throws LoaderError
     */
    public function render(string $template, array $data = []): string
    {
        return $this->twig->render($template, $data);
    }

    /**
     * @return Environment
     */
    public function environment(): Environment
    {
        return $this->twig;
    }
}
