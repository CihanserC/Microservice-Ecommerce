using Catalog.Application.Products.Queries.GetProducts;
using Catalog.Infrastructure.Persistence;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Products.Queries;

public sealed class GetProductsHandler(CatalogDbContext context)
    : IRequestHandler<GetProductsQuery, IReadOnlyList<ProductListItemDto>>
{
    public async Task<IReadOnlyList<ProductListItemDto>> Handle(
        GetProductsQuery request,
        CancellationToken cancellationToken)
    {
        return await context.Products
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(p => new ProductListItemDto(p.Id, p.Name, p.Price, p.ImageUrl))
            .ToListAsync(cancellationToken);
    }
}
