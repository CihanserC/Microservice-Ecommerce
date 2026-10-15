using Catalog.Application.Products.Queries.GetProductById;
using Catalog.Infrastructure.Persistence;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Products.Queries;

public sealed class GetProductByIdHandler(CatalogDbContext context)
    : IRequestHandler<GetProductByIdQuery, ProductDto?>
{
    public async Task<ProductDto?> Handle(GetProductByIdQuery request, CancellationToken cancellationToken)
    {
        return await context.Products
            .AsNoTracking()
            .Where(p => p.Id == request.Id)
            .Select(p => new ProductDto(
                p.Id,
                p.Name,
                p.Description,
                p.Price,
                p.ImageUrl,
                p.Stock,
                p.CreatedAt,
                p.UpdatedAt))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
