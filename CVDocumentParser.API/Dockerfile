FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["CVDocumentParser.API.csproj", "."]
RUN dotnet restore "CVDocumentParser.API.csproj"
COPY . .
RUN dotnet build "CVDocumentParser.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "CVDocumentParser.API.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "CVDocumentParser.API.dll"]
