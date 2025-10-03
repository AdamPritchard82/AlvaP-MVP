using FluentValidation;

namespace CVDocumentParser.API.Validators
{
    public class FileUploadValidator : AbstractValidator<IFormFile>
    {
        private readonly string[] _allowedExtensions = { ".pdf", ".docx", ".doc" };
        private readonly long _maxFileSize = 10 * 1024 * 1024; // 10MB

        public FileUploadValidator()
        {
            RuleFor(file => file)
                .NotNull()
                .WithMessage("File is required.");

            RuleFor(file => file.Length)
                .GreaterThan(0)
                .WithMessage("File cannot be empty.")
                .LessThanOrEqualTo(_maxFileSize)
                .WithMessage($"File size cannot exceed {_maxFileSize / (1024 * 1024)}MB.");

            RuleFor(file => file.FileName)
                .Must(HaveValidExtension)
                .WithMessage($"Only the following file types are allowed: {string.Join(", ", _allowedExtensions)}");

            RuleFor(file => file)
                .Must(HaveValidContentType)
                .WithMessage("File content does not match the file extension.");
        }

        private bool HaveValidExtension(string fileName)
        {
            if (string.IsNullOrEmpty(fileName))
                return false;

            var extension = Path.GetExtension(fileName).ToLowerInvariant();
            return _allowedExtensions.Contains(extension);
        }

        private bool HaveValidContentType(IFormFile file)
        {
            if (file == null || string.IsNullOrEmpty(file.FileName))
                return false;

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            var contentType = file.ContentType.ToLowerInvariant();

            // Validate content type matches extension
            return extension switch
            {
                ".pdf" => contentType == "application/pdf",
                ".docx" => contentType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".doc" => contentType == "application/msword",
                _ => false
            };
        }
    }
}
