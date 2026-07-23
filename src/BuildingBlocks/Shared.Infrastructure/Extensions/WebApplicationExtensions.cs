using Microsoft.AspNetCore.Builder;
using Shared.Infrastructure.Middleware;

namespace Shared.Infrastructure.Extensions;

public static class WebApplicationExtensions
{
    public static WebApplication UseSharedInfrastructure(this WebApplication app)
    {
        app.UseMiddleware<ExceptionHandlingMiddleware>();
        return app;
    }
}
