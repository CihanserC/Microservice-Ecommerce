using Basket.API.Models;
using Basket.API.Services;
using MassTransit;
using Shared.Contracts.Events;
using Shared.Contracts.Simulation;
using Shared.Infrastructure.Simulation;

namespace Basket.API.Endpoints;

public static class BasketEndpoints
{
    public static void MapBasketEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/basket").WithTags("Basket");

        group.MapGet("/{userName}", async (string userName, BasketService basketService, CancellationToken ct) =>
        {
            var basket = await basketService.GetBasketAsync(userName, ct);
            return basket is not null ? Results.Ok(basket) : Results.NotFound();
        });

        group.MapPost("/", async (
            StoreBasketRequest request,
            BasketService basketService,
            ISimulationTracer tracer,
            CancellationToken ct) =>
        {
            var basket = new ShoppingBasket
            {
                UserName = request.UserName,
                Items = request.Items.Select(i => new BasketItem
                {
                    ProductId = i.ProductId,
                    ProductName = i.ProductName,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice
                }).ToList()
            };

            var stored = await basketService.StoreBasketAsync(basket, ct);

            await tracer.TraceAsync(
                new($"Sepet Redis'e yazıldı (basket:{stored.UserName})", $"Basket written to Redis (basket:{stored.UserName})"),
                TraceKinds.Database,
                detail: new("Sepet geçici veridir: ilişkisel tablo yerine JSON olarak tek bir Redis anahtarında durur.",
                    "A basket is temporary data: it lives as JSON under a single Redis key instead of relational tables."),
                payload: stored);

            return Results.Ok(stored);
        });

        group.MapDelete("/{userName}", async (string userName, BasketService basketService, CancellationToken ct) =>
        {
            await basketService.DeleteBasketAsync(userName, ct);
            return Results.NoContent();
        });

        group.MapPost("/checkout", async (
            CheckoutRequest request,
            BasketService basketService,
            IPublishEndpoint publishEndpoint,
            ISimulationTracer tracer,
            CancellationToken ct) =>
        {
            var basket = await basketService.GetBasketAsync(request.UserName, ct);
            if (basket is null || basket.Items.Count == 0)
                return Results.BadRequest(new { message = "Basket is empty or does not exist." });

            var checkoutEvent = new BasketCheckoutEvent
            {
                UserName = basket.UserName,
                TotalPrice = basket.TotalPrice,
                Items = basket.Items.Select(i => new BasketCheckoutItem
                {
                    ProductId = i.ProductId,
                    ProductName = i.ProductName,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice
                }).ToList()
            };

            // Basket, Order servisini HTTP ile çağırmaz; olayı bırakır ve işini bitirir.
            // Order kapalı olsa bile mesaj kuyrukta bekler.
            await publishEndpoint.Publish(checkoutEvent, ct);
            await basketService.DeleteBasketAsync(basket.UserName, ct);

            await tracer.TraceAsync(
                new("Sepet Redis'ten silindi, istemciye 202 Accepted dönülüyor",
                    "Basket deleted from Redis, returning 202 Accepted to the client"),
                TraceKinds.Database,
                detail: new("202 = \"isteğini aldım, işleniyor\". Siparişin oluşup oluşmadığını istemci daha sonra /orders ile öğrenir.",
                    "202 = \"I got your request and it is being processed\". The client finds out later via /orders whether the order was created."));

            return Results.Accepted(value: new { message = "Checkout initiated.", totalPrice = basket.TotalPrice });
        });
    }
}

public sealed record StoreBasketRequest(string UserName, List<StoreBasketItemRequest> Items);

public sealed record StoreBasketItemRequest(
    Guid ProductId,
    string ProductName,
    int Quantity,
    decimal UnitPrice);

public sealed record CheckoutRequest(string UserName);
