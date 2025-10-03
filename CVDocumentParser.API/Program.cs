using CVDocumentParser.API.Services;
using CVDocumentParser.API.Validators;
using FluentValidation;

var builder = WebApplication.CreateBuilder(args);

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

// Add CORS policy for frontend integration
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
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

app.UseCors("AllowAll");

app.UseAuthorization();

app.MapControllers();

app.Run();
