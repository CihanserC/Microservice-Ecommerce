FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["src/BuildingBlocks/Shared.Contracts/Shared.Contracts.csproj", "src/BuildingBlocks/Shared.Contracts/"]
COPY ["src/BuildingBlocks/Shared.Infrastructure/Shared.Infrastructure.csproj", "src/BuildingBlocks/Shared.Infrastructure/"]
COPY ["src/Web/Simulator.Web/Simulator.Web.csproj", "src/Web/Simulator.Web/"]

RUN dotnet restore "src/Web/Simulator.Web/Simulator.Web.csproj"

COPY . .
WORKDIR /src/src/Web/Simulator.Web
RUN dotnet publish "Simulator.Web.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 8080
COPY --from=build /app/publish .
# Kod görüntüleyici için kaynak kodun bir kopyası (bin/obj .dockerignore ile dışarıda).
COPY --from=build /src/src /app/source
ENV ASPNETCORE_URLS=http://+:8080
ENV Simulator__SourceRoot=/app/source
ENTRYPOINT ["dotnet", "Simulator.Web.dll"]
