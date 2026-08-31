<?php

namespace Albert\Core\Console\Commands;

use Albert\backend\Core\Http\Router;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Helper\Table;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'route:list', description: 'List all registered routes')]
class RouteListCommand extends Command
{
    public function __construct(private readonly Router $router)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $rows = array_map(function ($route) {
            return [$route->method(), $route->uri(), $route->name() ?? '', $this->describeAction($route->action())];
        }, $this->router->all());

        (new Table($output))
            ->setHeaders(['Method', 'URI', 'Name', 'Action'])
            ->setRows($rows)
            ->render();

        return Command::SUCCESS;
    }

    private function describeAction(mixed $action): string
    {
        if (is_array($action)) {
            return $action[0] . '@' . $action[1];
        }

        return 'Closure';
    }
}
