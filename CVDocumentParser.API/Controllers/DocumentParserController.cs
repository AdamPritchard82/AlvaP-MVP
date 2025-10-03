using CVDocumentParser.API.DTOs;
using CVDocumentParser.API.Services;
using CVDocumentParser.API.Validators;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace CVDocumentParser.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentParserController : ControllerBase
    {
        private readonly ILogger<DocumentParserController> _logger;
        private readonly IEnumerable<IDocumentParsingService> _parsingServices;
        private readonly IValidator<IFormFile> _fileValidator;

        public DocumentParserController(
            ILogger<DocumentParserController> logger,
            IEnumerable<IDocumentParsingService> parsingServices,
            IValidator<IFormFile> fileValidator)
        {
            _logger = logger;
            _parsingServices = parsingServices;
            _fileValidator = fileValidator;
        }

        [HttpPost("parse")]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<CVParseResponse>> ParseCV(IFormFile? file)
        {
            _logger.LogInformation("Received CV parsing request for file: {FileName}", file?.FileName);

            try
            {
                if (file == null)
                {
                    return BadRequest(new CVParseResponse
                    {
                        Success = false,
                        Message = "No file provided",
                        Errors = new List<string> { "File parameter is required" }
                    });
                }

                // Validate the uploaded file
                var validationResult = await _fileValidator.ValidateAsync(file);
                if (!validationResult.IsValid)
                {
                    var errors = validationResult.Errors.Select(e => e.ErrorMessage).ToList();
                    return BadRequest(new CVParseResponse
                    {
                        Success = false,
                        Message = "File validation failed",
                        Errors = errors
                    });
                }

                // Find appropriate parsing service
                var parsingService = _parsingServices.FirstOrDefault(s => s.CanParse(file.FileName));
                if (parsingService == null)
                {
                    return BadRequest(new CVParseResponse
                    {
                        Success = false,
                        Message = "Unsupported file format",
                        Errors = new List<string> { $"No parser available for file: {file.FileName}" }
                    });
                }

                // Parse the document
                using var stream = file.OpenReadStream();
                var parsedData = await parsingService.ParseDocumentAsync(stream, file.FileName);

                _logger.LogInformation("Successfully parsed CV: {FileName}", file.FileName);

                return Ok(new CVParseResponse
                {
                    Success = true,
                    Message = "CV parsed successfully",
                    Data = parsedData
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing CV file: {FileName}", file?.FileName);
                
                return StatusCode(500, new CVParseResponse
                {
                    Success = false,
                    Message = "Internal server error occurred while parsing the CV",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("health")]
        public ActionResult<object> HealthCheck()
        {
            return Ok(new
            {
                Status = "Healthy",
                Timestamp = DateTime.UtcNow,
                Version = "1.0.0"
            });
        }

        [HttpGet("supported-formats")]
        public ActionResult<object> GetSupportedFormats()
        {
            var supportedFormats = _parsingServices
                .Select(s => s.GetSupportedFileExtensions())
                .ToList();

            return Ok(new
            {
                SupportedFormats = supportedFormats,
                Description = "List of supported file formats for CV parsing"
            });
        }
    }
}
