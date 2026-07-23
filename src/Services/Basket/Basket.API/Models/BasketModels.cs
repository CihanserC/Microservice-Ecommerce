namespace Basket.API.Models;

public sealed class BasketItem
{
    public required Guid ProductId { get; init; }
    public required string ProductName { get; init; }
    public required int Quantity { get; init; }
    public required decimal UnitPrice { get; init; }
    public decimal LineTotal => Quantity * UnitPrice;
}

public sealed class ShoppingBasket
{
    public required string UserName { get; init; }
    public List<BasketItem> Items { get; set; } = [];
    public decimal TotalPrice => Items.Sum(i => i.LineTotal);
}
