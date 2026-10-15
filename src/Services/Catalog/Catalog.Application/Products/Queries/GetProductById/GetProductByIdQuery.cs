using MediatR;

namespace Catalog.Application.Products.Queries.GetProductById;

public sealed record GetProductByIdQuery(Guid Id) : IRequest<ProductDto?>;

public sealed record ProductDto(
    Guid Id,
    string Name,
    string? Description,
    decimal Price,
    string? ImageUrl,
    int Stock,
    DateTime CreatedAt,
    DateTime? UpdatedAt);
