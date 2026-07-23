using MediatR;

namespace Catalog.Application.Products.Queries.GetProducts;

public sealed record GetProductsQuery : IRequest<IReadOnlyList<ProductListItemDto>>;

public sealed record ProductListItemDto(
    Guid Id,
    string Name,
    decimal Price,
    string? ImageUrl);
