using Catalog.Application.Products.Commands.CreateProduct;
using Catalog.Application.Products.Commands.DeleteProduct;
using Catalog.Application.Products.Commands.UpdateProduct;
using Catalog.Application.Products.Queries.GetProductById;
using Catalog.Application.Products.Queries.GetProducts;
using MediatR;

namespace Catalog.API.Endpoints;

public static class ProductEndpoints
{
    public static RouteGroupBuilder MapProductEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/products").WithTags("Products");

        group.MapGet("/", async (ISender sender) =>
        {
            var products = await sender.Send(new GetProductsQuery());
            return Results.Ok(products);
        });

        group.MapGet("/{id:guid}", async (Guid id, ISender sender) =>
        {
            var product = await sender.Send(new GetProductByIdQuery(id));
            return product is not null ? Results.Ok(product) : Results.NotFound();
        });

        group.MapPost("/", async (CreateProductRequest request, ISender sender) =>
        {
            var id = await sender.Send(new CreateProductCommand(
                request.Name,
                request.Description,
                request.Price,
                request.ImageUrl,
                request.Stock));

            return Results.Created($"/api/products/{id}", new { id });
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateProductRequest request, ISender sender) =>
        {
            var updated = await sender.Send(new UpdateProductCommand(
                id,
                request.Name,
                request.Description,
                request.Price,
                request.ImageUrl,
                request.Stock));

            return updated ? Results.NoContent() : Results.NotFound();
        });

        group.MapDelete("/{id:guid}", async (Guid id, ISender sender) =>
        {
            var deleted = await sender.Send(new DeleteProductCommand(id));
            return deleted ? Results.NoContent() : Results.NotFound();
        });

        return group;
    }
}

public sealed record CreateProductRequest(
    string Name,
    string? Description,
    decimal Price,
    string? ImageUrl,
    int Stock = 0);

public sealed record UpdateProductRequest(
    string Name,
    string? Description,
    decimal Price,
    string? ImageUrl,
    int Stock = 0);
