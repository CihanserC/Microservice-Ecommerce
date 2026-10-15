using Catalog.Application.Products.Commands.CreateProduct;
using Catalog.Domain.Entities;
using Catalog.Infrastructure.Persistence;
using MediatR;

namespace Catalog.Infrastructure.Products.Commands;

public sealed class CreateProductHandler(CatalogDbContext context)
    : IRequestHandler<CreateProductCommand, Guid>
{
    public async Task<Guid> Handle(CreateProductCommand request, CancellationToken cancellationToken)
    {
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            Price = request.Price,
            ImageUrl = request.ImageUrl,
            Stock = request.Stock
        };

        context.Products.Add(product);
        await context.SaveChangesAsync(cancellationToken);

        return product.Id;
    }
}
