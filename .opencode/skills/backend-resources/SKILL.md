---
name: backend-resources
description: Curated free backend, API, database, security, testing, and DevOps resource catalog for agents - specs, docs, patterns, tools, and checklists with selection guidance and cautions.
---

# Backend / API / DB / Security Resources (Free-first)

Use this skill when designing, implementing, reviewing, or debugging backend systems, APIs, databases, auth, reliability, or delivery. Pick resources by **job-to-be-done**, not popularity. **Primary docs/specs first** for fast-moving libraries/APIs; verify current version, compatibility, license, and security implications before implementing. Do not copy patterns blindly - match them to actual constraints.

## 1) API design & contracts

| Need | Free sources | Use for | Caution |
|---|---|---|---|
| REST design rules | [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines), [Google AIP](https://google.aip.dev/), [Zalando RESTful API Guidelines](https://opensource.zalando.com/restful-api-guidelines/), [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110) | Resource naming, methods, status codes, pagination, filtering, errors, versioning | Pick one convention per API; document it. Don't mix styles randomly. |
| API specs/contracts | [OpenAPI Spec](https://spec.openapis.org/oas/latest.html), [Swagger Editor](https://editor.swagger.io/), [AsyncAPI](https://www.asyncapi.com/), [JSON Schema](https://json-schema.org/) | Contract-first design, validation, docs, codegen, event schemas | Spec must match implementation; validate in CI. |
| GraphQL | [GraphQL Spec](https://spec.graphql.org/), [GraphQL Learn](https://graphql.org/learn/), [Apollo Docs](https://www.apollographql.com/docs/) | Schema design, queries/mutations, pagination, caching, federation | Watch N+1 resolvers, field-level authZ, query complexity/depth limits. |
| gRPC/protobuf | [gRPC Docs](https://grpc.io/docs/), [Protocol Buffers](https://protobuf.dev/), [ConnectRPC](https://connectrpc.com/docs/) | Service contracts, streaming, typed RPC, compatibility | Field numbers/types are compatibility contracts; never reuse/remove carelessly. |
| Events/webhooks | [CloudEvents](https://cloudevents.io/), [Standard Webhooks](https://www.standardwebhooks.com/), [AsyncAPI](https://www.asyncapi.com/) | Event schemas, delivery, idempotency, signatures, retries | Require idempotency keys/signatures; treat retries/duplicates as normal. |

## 2) Backend architecture & reliability

| Need | Free sources | Use for | Caution |
|---|---|---|---|
| Core architecture | [12-Factor App](https://12factor.net/), [Martin Fowler Architecture](https://martinfowler.com/architecture/), [microservices.io](https://microservices.io/), [C4 Model](https://c4model.com/) | Service boundaries, config, modularity, deployment, diagrams | Don't over-engineer; start simple, split only when boundaries are real. |
| System design | [System Design Primer](https://github.com/donnemartin/system-design-primer), [AWS Builders Library](https://aws.amazon.com/builders-library/), [Google SRE Workbook](https://sre.google/workbook/table-of-contents/) | Caching, queues, scaling, consistency, SLOs, incident patterns | Educational patterns != requirements; match to actual scale/constraints. |
| Domain/data patterns | [Fowler EAA Catalog](https://martinfowler.com/eaaCatalog/), [DDD Reference (Evans)](https://www.domainlanguage.com/ddd/reference/) | Repositories, UoW, aggregates, domain boundaries | Avoid cargo-cult DDD for small CRUD apps. |
| Resilience | [Azure Architecture Patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/), [AWS Builders Library](https://aws.amazon.com/builders-library/) | Timeouts, retries, circuit breakers, idempotency, backpressure | Retries without budgets/idempotency/cap cause outages. |

## 3) Databases & data modeling

| Need | Free sources | Use for | Caution |
|---|---|---|---|
| PostgreSQL | [PostgreSQL Docs](https://www.postgresql.org/docs/current/), [Postgres Wiki](https://wiki.postgresql.org/wiki/Main_Page), [Use The Index, Luke](https://use-the-index-luke.com/) | Schema, indexes, transactions, EXPLAIN, performance, ops | Measure with `EXPLAIN (ANALYZE, BUFFERS)`; indexes are write/storage tradeoffs. |
| SQL learning/design | [SQLBolt](https://sqlbolt.com/), [PostgreSQL Exercises](https://pgexercises.com/), [Mode SQL Tutorial](https://mode.com/sql-tutorial/) | Query fluency, joins, aggregates, windows | Practice DB != production; add constraints/indexes deliberately. |
| Data modeling | [drawDB](https://www.drawdb.app/), [dbdiagram.io](https://dbdiagram.io/), [Liquibase Data Model Docs](https://docs.liquibase.com/) | ERD/schema drafts, relationship review | Diagram is not migration; enforce constraints/FKs in DB. |
| SQLite/embedded | [SQLite Docs](https://www.sqlite.org/docs.html), [SQLite When To Use](https://www.sqlite.org/whentouse.html) | Local/embedded/simple server use cases | Know concurrency/write limits/WAL behavior before choosing. |
| Caching/Redis | [Redis Docs](https://redis.io/docs/latest/), [Redis University](https://university.redis.io/) | Caching, TTL, rate limits, queues, pub/sub | Cache invalidation/consistency is a product decision; set TTLs and bounds. |
| ORM/query/migrations | [Prisma Docs](https://www.prisma.io/docs), [Drizzle Docs](https://orm.drizzle.team/docs/overview), [Knex](https://knexjs.org/), [SQLAlchemy](https://docs.sqlalchemy.org/), [Flyway](https://documentation.red-gate.com/fd), [Alembic](https://alembic.sqlalchemy.org/) | Safe queries, schema evolution, migrations | ORMs can hide bad queries; inspect generated SQL for hot paths. Avoid destructive migrations without backup/roll-forward plan. |

## 4) Auth, security, and privacy

| Need | Free sources | Use for | Caution |
|---|---|---|---|
| AppSec baseline | [OWASP Top 10](https://owasp.org/www-project-top-ten/), [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/), [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) | Secure coding requirements/checklists | Use ASVS level appropriate to risk; Top 10 is not complete. |
| AuthN/AuthZ | [OAuth 2.0](https://oauth.net/2/), [OpenID Connect](https://openid.net/developers/how-connect-works/), [OWASP AuthZ Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Login, tokens, sessions, RBAC/ABAC, scopes | Never roll your own crypto/auth protocol; enforce authZ server-side on every request. |
| API/web security | [OWASP API Security Top 10](https://owasp.org/API-Security/), [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), [PortSwigger Web Security Academy](https://portswigger.net/web-security) | BOLA, rate limits, input validation, SSRF, injection, CORS/CSRF | "Internal" APIs are still attack surface; validate server-side. |
| Secrets/supply chain | [GitHub Advisory Database](https://github.com/advisories), [OSV](https://osv.dev/), [OpenSSF Scorecard](https://securityscorecards.dev/), [OWASP Dependency-Check](https://owasp.org/www-project-dependency-check/) | Dependency vulns, supply chain hygiene, secret handling | No secrets in code/logs/prompts; patch with compatibility checks. |
| Privacy/compliance basics | [GDPR for Developers](https://gdpr.eu/developers/), [NIST Privacy Framework](https://www.nist.gov/privacy-framework) | Data minimization, retention, user data handling | Context-specific; escalate legal/compliance questions. |

## 5) Testing, quality, and observability

| Need | Free sources | Use for | Caution |
|---|---|---|---|
| Testing strategy | [Martin Fowler Testing](https://martinfowler.com/testing/), [Testing Trophy](https://kentcdodds.com/blog/write-tests) | Unit/integration/e2e boundaries, confidence tradeoffs | Don't chase 100% coverage; test behavior/risk/edge paths. |
| API/load testing | [Playwright](https://playwright.dev/), [Vitest](https://vitest.dev/), [pytest](https://docs.pytest.org/), [k6 Docs](https://grafana.com/docs/k6/latest/), [Postman Learning](https://learning.postman.com/) | Regression, contract, smoke/load tests | Load tests only against permitted/prod-like envs; watch data side effects. |
| Observability | [OpenTelemetry Docs](https://opentelemetry.io/docs/), [Prometheus Docs](https://prometheus.io/docs/introduction/overview/), [Grafana Docs](https://grafana.com/docs/), [Sentry Docs](https://docs.sentry.io/) | Logs/metrics/traces, alerting, debugging | Never log secrets/PII; define SLOs before noisy alerts. |
| Code quality | [TypeScript Docs](https://www.typescriptlang.org/docs/), [ESLint](https://eslint.org/docs/latest/), [Ruff](https://docs.astral.sh/ruff/), [OpenAPI Validator tools](https://github.com/APIDevTools) | Static checks, type safety, lint rules, contract checks | Lint green != correct; pair with tests and runtime validation. |

## 6) DevOps / runtime / delivery

| Need | Free sources | Use for | Caution |
|---|---|---|---|
| Containers/runtime | [Docker Docs](https://docs.docker.com/), [Kubernetes Docs](https://kubernetes.io/docs/home/), [Helm Docs](https://helm.sh/docs/) | Packaging, local dev, deployment, orchestration | K8s adds complexity; don't default to it for small apps. |
| CI/CD | [GitHub Actions Docs](https://docs.github.com/actions), [GitLab CI Docs](https://docs.gitlab.com/ee/ci/), [Dagger Docs](https://docs.dagger.io/) | Build/test/release pipelines, caching, artifacts | Pin actions/deps; protect secrets; least privilege; no auto deploy without approval. |
| Infra as code | [Terraform Docs](https://developer.hashicorp.com/terraform/docs), [OpenTofu Docs](https://opentofu.org/docs/), [Pulumi Docs](https://www.pulumi.com/docs/) | Reproducible infra, reviewable changes | IaC changes can be destructive; plan/review before apply. |
| Cloud/reference arch | [AWS Well-Architected](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html), [Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/), [Google Cloud Architecture Center](https://cloud.google.com/architecture) | Reference architectures, tradeoffs, NFRs | Vendor-flavored; separate principles from lock-in. |

## 7) Agent selection workflow

1. **Clarify the job** - API design, DB schema, auth, performance, reliability, security review, delivery, etc. Identify constraints: data shape, consistency, latency, scale, team skill, deployment, compliance.
2. **Start with primary sources** - official spec/vendor/framework docs first; use `context7` for library APIs and `websearch`/`webfetch` for current guidance/advisories.
3. **Pick 2-3 references max** - one spec/standard, one implementation doc, one security/operability checklist. Avoid source sprawl.
4. **Extract the decision** - record tradeoffs, version/date, compatibility, migration/rollback, and security implications.
5. **Implement minimally** - follow existing repo patterns; add tests/checks for behavior and edge/failure paths.
6. **Verify with sensors** - lint/typecheck/tests, migration dry-run, `EXPLAIN`, contract validation, security scans, or load smoke as appropriate. Never claim unrun checks.

## Quick defaults

- **CRUD API**: OpenAPI + framework docs + Postgres docs + OWASP API/REST Security + integration tests.
- **Auth system**: OWASP ASVS/AuthZ/Session cheat sheets + OAuth2/OIDC docs + framework auth docs; avoid custom crypto/auth.
- **Data-heavy backend**: Postgres docs + Use The Index, Luke + `EXPLAIN (ANALYZE, BUFFERS)` + migration tool docs + k6 smoke.
- **Event-driven system**: AsyncAPI/CloudEvents + Standard Webhooks/idempotency patterns + OpenTelemetry + retry budgets.
- **Production hardening**: OWASP Top 10/API Top 10 + SRE Workbook + OpenTelemetry + dependency/advisory scan + CI least privilege.