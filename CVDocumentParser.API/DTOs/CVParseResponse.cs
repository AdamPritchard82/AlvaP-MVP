using CVDocumentParser.API.Models;

namespace CVDocumentParser.API.DTOs
{
    public class CVParseResponse
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
        public ParsedCVData? Data { get; set; }
        public List<string> Errors { get; set; } = new List<string>();
        public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
    }
}
