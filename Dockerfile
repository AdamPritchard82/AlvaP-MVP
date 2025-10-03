# Use the official .NET 8.0 runtime as the base image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

# Use the .NET 8.0 SDK to build the application
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["CVDocumentParser.API/CVDocumentParser.API.csproj", "CVDocumentParser.API/"]
RUN dotnet restore "CVDocumentParser.API/CVDocumentParser.API.csproj"
COPY CVDocumentParser.API/ CVDocumentParser.API/
RUN dotnet build "CVDocumentParser.API/CVDocumentParser.API.csproj" -c Release -o /app/build

# Publish the application
FROM build AS publish
RUN dotnet publish "CVDocumentParser.API/CVDocumentParser.API.csproj" -c Release -o /app/publish

# Create the final runtime image
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "CVDocumentParser.API.dll"]
