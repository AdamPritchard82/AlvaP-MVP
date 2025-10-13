using CVDocumentParser.API.Services;
using CVDocumentParser.API.Validators;
using FluentValidation;

var builder = WebApplication.CreateBuilder(args);

// Configure port binding for Railway
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024; // 10MB
    // Fix timeout issues for file uploads
    options.Limits.MinRequestBodyDataRate = null; // Disable minimum data rate requirement
    options.Limits.RequestHeadersTimeout = TimeSpan.FromMinutes(2); // 2 minutes for headers
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(2); // 2 minutes keep alive
});

// Force port binding for Railway
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
var aspnetcoreUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");

Console.WriteLine($"PORT from env: {port}");
Console.WriteLine($"ASPNETCORE_URLS: {aspnetcoreUrls}");

// Try to extract port from ASPNETCORE_URLS if PORT is not set
if (port == "8080" && !string.IsNullOrEmpty(aspnetcoreUrls))
{
    var match = System.Text.RegularExpressions.Regex.Match(aspnetcoreUrls, @":(\d+)");
    if (match.Success)
    {
        port = match.Groups[1].Value;
        Console.WriteLine($"Extracted port from ASPNETCORE_URLS: {port}");
    }
}

// Set the URL explicitly
var url = $"http://0.0.0.0:{port}";
Console.WriteLine($"Final URL: {url}");
builder.WebHost.UseUrls(url);
Environment.SetEnvironmentVariable("ASPNETCORE_URLS", url);

// Add services to the container.
builder.Services.AddControllers();

// Add document parsing services
builder.Services.AddScoped<IDocumentParsingService, PdfParsingService>();
builder.Services.AddScoped<IDocumentParsingService, WordParsingService>();

// Add configuration
builder.Services.Configure<CVDocumentParser.API.Configuration.ParsingConfiguration>(
    builder.Configuration.GetSection(CVDocumentParser.API.Configuration.ParsingConfiguration.SectionName));

// Add validators
builder.Services.AddScoped<IValidator<IFormFile>, FileUploadValidator>();

// Add FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<FileUploadValidator>();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { 
        Title = "CV Document Parser API", 
        Version = "v1",
        Description = "An API for parsing CV documents from PDF and Word formats"
    });
});

// Add CORS policy for AlvaP integration
var origins = new [] {
    "https://alvap-mvp-production.up.railway.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
};

builder.Services.AddCors(options =>
{
    options.AddPolicy("alvap", policy =>
        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// Configure file upload size limits
builder.Services.Configure<IISServerOptions>(options =>
{
    options.MaxRequestBodySize = 10 * 1024 * 1024; // 10MB
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "CV Document Parser API v1");
        c.RoutePrefix = string.Empty; // Set Swagger UI at the app's root
    });
}

app.UseHttpsRedirection();

app.UseCors("alvap");

app.UseAuthorization();

app.MapControllers();

// Add health endpoints for Railway
app.MapGet("/healthz", () => Results.Json(new { status = "ok" }));
app.MapGet("/health", () => Results.Json(new { status = "ok" }));
app.MapGet("/", () => Results.Json(new { status = "ok", message = "CV Parser API is running" }));

app.Run();
