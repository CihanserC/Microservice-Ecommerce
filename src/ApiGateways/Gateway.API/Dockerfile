FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["src/BuildingBlocks/Shared.Infrastructure/Shared.Infrastructure.csproj", "src/BuildingBlocks/Shared.Infrastructure/"]
COPY ["src/BuildingBlocks/Shared.Contracts/Shared.Contracts.csproj", "src/BuildingBlocks/Shared.Contracts/"]
COPY ["src/ApiGateways/Gateway.API/Gateway.API.csproj", "src/ApiGateways/Gateway.API/"]

RUN dotnet restore "src/ApiGateways/Gateway.API/Gateway.API.csproj"

COPY . .
WORKDIR /src/src/ApiGateways/Gateway.API
RUN dotnet publish "Gateway.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 8080
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "Gateway.API.dll"]
