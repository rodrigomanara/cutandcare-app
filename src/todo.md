## Todo List

### Phase 1: Research Laravel and competitive analysis
- [x] Research Laravel's core features, architecture, and ecosystem.
- [x] Identify key competitors and their strengths/weaknesses.
- [x] Analyze market trends and user needs for web frameworks.
- [x] Summarize findings in a research report.

### Phase 2: Design framework architecture and core features
- [x] Define the overall architecture of the new framework.
- [x] Outline core features and modules.
- [x] Specify design principles and conventions.

### Phase 3: Implement core framework components
- [x] Set up project structure and basic dependencies.
- [x] Implement core utilities and helper functions.
- [x] Develop a dependency injection container.

### Phase 4: Create routing and middleware system
- [x] Design and implement a flexible routing system. (`Albert\Http\Router`/`Route` — method-based routes, `{param}` segments, named routes.)
- [x] Develop a middleware pipeline for request processing. (`Albert\Http\MiddlewareInterface` + onion-style pipeline in `Kernel`.)

### Phase 5: Implement ORM and database layer
- [x] Create a database abstraction layer. (`Albert\Database\Connection` — Doctrine DBAL-backed, sqlite by default, MySQL/Postgres via env config.)
- [ ] Design and implement a full Object-Relational Mapper (ORM). Only a minimal Active Record base (`Albert\Database\Model`: `all`/`find`/`where`/`create`/`save`/`delete`) exists — no relationships, migrations, or eager loading yet.

### Phase 6: Build templating engine and view system
- [x] Develop a templating engine. (Twig, via `Albert\View\View`.)
- [x] Implement a view rendering system. (`View::render()`; example template at `resources/views/welcome.twig`.)

### Phase 7: Create CLI tools and project scaffolding
- [x] Build command-line interface (CLI) tools for common tasks. (`bin/console` on Symfony Console: `route:list`, `make:controller`.)
- [ ] Develop broader project scaffolding for quick setup (only controller generation exists so far).
- [ ] add support for RestApi and GraphQL
- [x] add support a custom folder so new development will be done there not on the main files (top-level `src/App/` directory, namespace `App\`, holds controllers/models/routes/views; `src/` is now framework-core only.)
- [ ] add feature to generate a model setup (Controller , View and Module)
### Phase 8: Develop authentication and security features
- [ ] Implement authentication and authorization mechanisms.
- [ ] Integrate security best practices.

### Phase 9: Build example applications and demos
- [ ] Develop a variety of example applications.
- [ ] Create interactive demos showcasing framework features.

### Phase 10: Create comprehensive documentation
- [ ] Write detailed documentation for all framework components.
- [ ] Provide tutorials and guides for common use cases.

### Phase 11: Package and deploy framework for distribution
- [ ] Prepare the framework for distribution.
- [ ] Set up deployment pipelines.

### Phase 12: Present final framework to user
- [ ] Present the completed framework to the user.
- [ ] Provide access to code, documentation, and demos.

