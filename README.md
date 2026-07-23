# Microservice E-Commerce (.NET 10)

A minimalist, production-ready microservices skeleton for an e-commerce domain demonstrating decoupling, async/sync communication, API Gateway, observability, and containerization.

## Architecture

```
                    ┌─────────────┐
                    │ Gateway.API │  (YARP - port 5000)
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ Catalog.API │ │ Basket.API  │ │  Order.API  │
    │  PostgreSQL │ │    Redis    │ │  PostgreSQL │
    └─────────────┘ └──────┬──────┘ └──────▲──────┘
                             │               │
                             │  RabbitMQ     │
                             └───────────────┘
                              BasketCheckoutEvent
```

## Tech Stack

| Concern | Technology |
|---------|------------|
| Framework | .NET 10 / C# 14 |
| API Gateway | YARP |
| Async messaging | RabbitMQ + MassTransit |
| Relational data | PostgreSQL + EF Core 10 |
| Caching | Redis |
| Observability | OpenTelemetry + Serilog |
| Orchestration | Docker Compose |

## Solution Structure

```
src/
├── BuildingBlocks/
│   ├── Shared.Contracts/      # Integration events
│   └── Shared.Infrastructure/ # MassTransit, OpenTelemetry, Serilog, middleware
├── Services/
│   ├── Catalog/               # CQRS + Clean Architecture
│   ├── Basket/                # Minimal APIs + Redis
│   └── Order/                 # DDD + event consumer
└── ApiGateways/
    └── Gateway.API/           # YARP reverse proxy
```

## Quick Start (Docker)

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Gateway | http://localhost:5000 |
| Catalog (direct) | http://localhost:5001 |
| Basket (direct) | http://localhost:5002 |
| Order (direct) | http://localhost:5003 |
| RabbitMQ Management | http://localhost:15672 (guest/guest) |

## API Routes (via Gateway)

| Method | Gateway Path | Description |
|--------|--------------|-------------|
| GET | `/catalog` | List products |
| GET | `/catalog/{id}` | Get product |
| POST | `/catalog` | Create product |
| GET | `/basket/{userName}` | Get basket |
| POST | `/basket` | Store basket |
| POST | `/basket/checkout` | Checkout (publishes event) |
| GET | `/orders` | List orders |
| GET | `/orders/{id}` | Get order |

All services expose `/health`.

## Example Flow

```bash
# 1. Create a product
curl -X POST http://localhost:5000/catalog \
  -H "Content-Type: application/json" \
  -d '{"name":"Laptop","description":"Gaming laptop","price":1299.99}'

# 2. Add to basket
curl -X POST http://localhost:5000/basket \
  -H "Content-Type: application/json" \
  -d '{"userName":"john","items":[{"productId":"...","productName":"Laptop","quantity":1,"unitPrice":1299.99}]}'

# 3. Checkout
curl -X POST http://localhost:5000/basket/checkout \
  -H "Content-Type: application/json" \
  -d '{"userName":"john"}'

# 4. View orders (async processing)
curl http://localhost:5000/orders
```

## Local Development (without Docker)

1. Start infrastructure: PostgreSQL, Redis, RabbitMQ
2. Update connection strings in each service's `appsettings.json`
3. Run services:

```bash
dotnet run --project src/Services/Catalog/Catalog.API
dotnet run --project src/Services/Basket/Basket.API
dotnet run --project src/Services/Order/Order.API
dotnet run --project src/ApiGateways/Gateway.API
```

## License

See [LICENSE](LICENSE).
