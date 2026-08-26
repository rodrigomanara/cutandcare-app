# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is an early-stage PHP framework (Composer package `albert/framework`, working title "Nexus" in the design docs). A functional core MVP exists: DI container, event dispatcher, router with a middleware pipeline, a minimal database layer, Twig-based views, and a small CLI. There is no auth, no full ORM (relationships/migrations), no example apps beyond one demo route, and no formal docs/deployment tooling yet — see `src/todo.md` for exactly what's done vs. still open. Treat the two design docs in `src/` as the long-term spec/roadmap, not as documentation of current behavior.

`src/` is the framework core only (namespace `Albert\`). Application code — controllers, models, routes, views — lives in a separate top-level `app/` directory (namespace `App\`) so a future framework update to `src/` never touches user code. See "Application code (`app/`)" below.

### Core (`src/Core/`)

- `Container.php` — PSR-11 (`ContainerInterface`) DI container: `bind()`/`singleton()`/`instance()`, plus reflection-based constructor autowiring via `resolve()`/`get()`. Unresolvable dependencies throw `RuntimeException`.
- `EventListener.php` — in-memory pub/sub: `listen(string $event, callable $listener)`, `dispatch(string $event, mixed ...$payload): array` (collects each listener's return value), `forget()`, `hasListeners()`.
- `Kernel.php` — owns a `Container`, `EventListener`, and `Http\Router` (all self-registered into the container). `handle(Request): Response` matches the request against the router, binds route params onto `$request->attributes`, runs the middleware pipeline (global + per-route), dispatches to the controller/closure, and converts non-`Response` return values to a plain `Response`. Wraps the whole thing in a try/catch that emits a 500 (message shown only when `APP_DEBUG=true`). Dispatches `kernel.handling` / `kernel.handled` / `kernel.exception` events around this. `run()` builds the request from PHP globals and sends the response.

### HTTP (`src/Http/`)

- `Router.php` / `Route.php` — register routes with `get()/post()/put()/patch()/delete(uri, action, ?name)`; `{param}` URI segments become named capture groups exposed on `$request->attributes`. `Router::match()` returns the first `Route` whose method+path match, or `null` (→ 404 in the Kernel).
- `MiddlewareInterface.php` — `handle(Request $request, Closure $next): Response`. The Kernel builds an onion-style pipeline from global middleware (`Kernel::pushMiddleware()`) plus any route-specific middleware (`Route::middleware()`); middleware can be passed as an instance or a container-resolvable class string.
- `Middleware/AddHeaderMiddleware.php` — reference implementation (adds an `X-Powered-By` header).

### Database (`src/Database/`)

- `Connection.php` — builds a `Doctrine\DBAL\Connection` from env vars. Defaults to zero-config SQLite at `storage/database.sqlite` (relative to the app root) when `DB_CONNECTION` is unset; set `DB_CONNECTION`/`DB_DRIVER`/`DB_HOST`/`DB_PORT`/`DB_DATABASE`/`DB_USERNAME`/`DB_PASSWORD` for MySQL/Postgres/etc. **Important:** never default DB storage into a path that differs from an existing source namespace only by case (e.g. `database/` vs. `Database/`) — this repo is developed on a case-insensitive filesystem (macOS default) where the two would silently collide into one directory, corrupting or hiding files; that's why the storage default lives under `storage/`, not `database/`.
- `Model.php` — minimal Active Record: `all()`, `find($id)`, `where($column, $value)`, `create($attributes)`, `save()`, `delete()`. Subclasses just set `protected static string $table`. No relationships, casting, or migrations — call `Model::setConnection()` once at bootstrap (done in `bootstrap.php`).

### View (`src/View/`)

- `View.php` — thin wrapper around a Twig `Environment` with a `FilesystemLoader`. `render(string $template, array $data = []): string`. Templates live in `app/resources/views/`.

### Console (`src/Console/Commands/`)

- `MakeControllerCommand.php` (`make:controller {name}`) — scaffolds a plain controller class (namespace `App\Http\Controllers`) into `app/Http/Controllers/`.
- `RouteListCommand.php` (`route:list`) — prints all registered routes as a table.
- Entry point is `src/bin/console` (Symfony Console `Application`). **Do not name a CLI entry point `console` directly under `src/`** — it collides case-insensitively with the `Console/` namespace directory on this filesystem (this bit us once already; `bin/console` sidesteps it).

### Application code (`app/`)

- Top-level, sibling to `src/`. Namespace `App\`, mapped via `src/composer.json`'s `autoload.psr-4` (`"App\\": "../app/"`). Holds everything a project built on the framework actually owns, so `src/` can be updated/replaced without touching it:
  - `app/Http/Controllers/` — e.g. `HomeController.php` (the demo controller, now `App\Http\Controllers\HomeController`), and anything `make:controller` scaffolds.
  - `app/Models/` — user `Albert\Database\Model` subclasses (empty aside from a `.gitkeep` at MVP scope).
  - `app/routes/web.php` — the route table; add new routes here. A closure that receives the `Router` and registers routes.
  - `app/resources/views/` — Twig templates (e.g. `welcome.twig`).
- `src/bootstrap.php` loads `app/routes/web.php` and points `View` at `app/resources/views` — see below.

### Wiring it together

- `src/bootstrap.php` — loads `.env` (if present) via `vlucas/phpdotenv`, builds the `Kernel`, registers `View` (pointed at `app/resources/views`) and the DBAL `Connection` into the container, sets `Model::setConnection()`, registers `AddHeaderMiddleware` globally, and loads `app/routes/web.php` (a closure that receives the `Router` and registers routes) against `$kernel->router()`. Both `index.php` (HTTP) and `bin/console` (CLI) `require` this file to get a fully-wired `Kernel`.
- `.env.example` — copy to `.env` to override defaults (`APP_DEBUG`, `DB_*`).

### Roadmap docs

- `src/todo.md` — 12-phase roadmap; phases 1–7 done at MVP scope (research → routing/middleware/DB/views/CLI), phases 8–12 (auth, example apps, formal docs, packaging/deployment, presentation) intentionally not started — check this file before assuming a feature is missing or present.
- `src/Nexus Framework: Architecture and Design Specification.md` — the long-term target architecture (layered: Application/Domain/Infrastructure/Framework Core). Read before adding a new core component so it lands in the intended layer/namespace.
- `src/Laravel Research: Service Providers.md` — research notes on Laravel's service-provider pattern and competitive analysis that informed the design spec.

## Autoloading

`src/composer.json` maps two PSR-4 prefixes: `Albert\` → `./` (i.e. `src/`), so `Albert\Core\Kernel` resolves to `src/Core/Kernel.php`, `Albert\Http\Router` to `src/Http/Router.php`, etc.; and `App\` → `../app/` (i.e. the top-level `app/` directory), so `App\Http\Controllers\HomeController` resolves to `app/Http/Controllers/HomeController.php`. A new framework-core class just needs a matching directory under `src/` with matching case; a new application class goes under `app/` with matching case. After changing `autoload.psr-4` (not needed for new classes under an already-mapped prefix), regenerate with `composer dump-autoload` (or via Docker — mount the repo root, not just `src/`, since `App\` resolves outside `src/`: `docker run --rm -v "$PWD:/repo" -w /repo/src composer:2 dump-autoload`) since there's no local `composer`/`php` binary in this environment.

## Commands

All Composer commands run from `src/` (that's where `composer.json` lives, not the repo root).

```bash
cd src
composer install         # install dependencies (vendor/ is already populated in this checkout)
composer test            # phpunit (config: phpunit.xml, tests in tests/)
composer analyse         # phpstan analyse (config: phpstan.neon, level 5)
composer cs-check        # phpcs (config: phpcs.xml, PSR-12)
composer cs-fix          # phpcbf
```

Run a single test: `vendor/bin/phpunit tests/Http/RouterTest.php`. No `php` binary is available on the host in this environment — run these via Docker, e.g. `docker run --rm -v "$PWD/src:/app" -w /app php:8.4-cli php vendor/bin/phpunit`.

## Running the app

`docker-compose.yml` (repo root) defines two services and mounts the whole repo root (`.`, so both `src/` and `app/` are visible) into each container at `/var/www/html`:

- `php` — built from `docker/Dockerfile-php` (`php:8.4-fpm`, with `pdo_mysql`, `gd`, `zip`, and Composer installed).
- `nginx` — proxies `*.php` requests to `php` on port 9000 (config in `docker/nginx.conf`, document root `/var/www/html/src`); serves on host port 80.

```bash
docker-compose up --build
```

Note the PHP version mismatch: `composer.json` requires `php: ^8.3`, but the Docker image is `php:8.4-fpm`. The default SQLite DB layer needs no extra service, but `pdo_sqlite` should be confirmed present in the `php` image if you switch away from the base `php:8.4-fpm` image.

For quick manual testing without the full Docker Compose stack, run a single container against the repo root (needed so `app/`, which `bootstrap.php` reaches via `../app` from `src/`, is visible alongside `src/`):

```bash
docker run --rm -p 8000:8000 -v "$PWD:/repo" -w /repo/src php:8.4-cli php -S 0.0.0.0:8000 index.php
```
