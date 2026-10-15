using MediatR;

namespace Catalog.Application.Products.Commands.CreateProduct;

public sealed record CreateProductCommand(
    string Name,
    string? Description,
    decimal Price,
    string? ImageUrl,
    int Stock) : IRequest<Guid>;
