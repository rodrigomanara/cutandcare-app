<?php

namespace Albert\Core\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'make:controller', description: 'Create a new controller class')]
class MakeControllerCommand extends Command
{
    public function __construct(private readonly string $controllersPath)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('name', InputArgument::REQUIRED, 'The controller class name (e.g. PostController)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $name = $input->getArgument('name');
        $path = rtrim($this->controllersPath, '/') . '/' . $name . '.php';

        if (file_exists($path)) {
            $output->writeln("<error>Controller [$name] already exists.</error>");

            return Command::FAILURE;
        }

        $stub = <<<PHP
        <?php

        namespace App\\Http\\Controllers;

        use Symfony\\Component\\HttpFoundation\\Request;
        use Symfony\\Component\\HttpFoundation\\Response;

        class {$name}
        {
            public function index(Request \$request): Response
            {
                return new Response('{$name}::index');
            }
        }

        PHP;

        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }

        file_put_contents($path, $stub);

        $output->writeln("<info>Controller created:</info> $path");

        return Command::SUCCESS;
    }
}
