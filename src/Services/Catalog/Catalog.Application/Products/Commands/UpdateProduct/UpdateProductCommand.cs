using MediatR;

namespace Catalog.Application.Products.Commands.UpdateProduct;

public sealed record UpdateProductCommand(
    Guid Id,
    string Name,
    string? Description,
    decimal Price,
    string? ImageUrl) : IRequest<bool>;
