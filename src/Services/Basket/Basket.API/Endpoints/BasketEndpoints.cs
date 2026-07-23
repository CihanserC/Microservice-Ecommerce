using Basket.API.Models;
using Basket.API.Services;
using MassTransit;
using Shared.Contracts.Events;

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

        group.MapPost("/", async (StoreBasketRequest request, BasketService basketService, CancellationToken ct) =>
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

            await publishEndpoint.Publish(checkoutEvent, ct);
            await basketService.DeleteBasketAsync(basket.UserName, ct);

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
