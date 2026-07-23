using System.Text.Json;
using Basket.API.Models;
using Microsoft.Extensions.Caching.Distributed;

namespace Basket.API.Services;

public sealed class BasketService(IDistributedCache cache)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<ShoppingBasket?> GetBasketAsync(string userName, CancellationToken cancellationToken)
    {
        var data = await cache.GetStringAsync(GetCacheKey(userName), cancellationToken);
        return data is null ? null : JsonSerializer.Deserialize<ShoppingBasket>(data, JsonOptions);
    }

    public async Task<ShoppingBasket> StoreBasketAsync(ShoppingBasket basket, CancellationToken cancellationToken)
    {
        var data = JsonSerializer.Serialize(basket, JsonOptions);
        await cache.SetStringAsync(GetCacheKey(basket.UserName), data, cancellationToken);
        return basket;
    }

    public Task DeleteBasketAsync(string userName, CancellationToken cancellationToken) =>
        cache.RemoveAsync(GetCacheKey(userName), cancellationToken);

    private static string GetCacheKey(string userName) => $"basket:{userName}";
}
