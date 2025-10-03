using CVDocumentParser.API.Models;

namespace CVDocumentParser.API.Services
{
    public interface IDocumentParsingService
    {
        Task<ParsedCVData> ParseDocumentAsync(Stream documentStream, string fileName);
        bool CanParse(string fileName);
        string GetSupportedFileExtensions();
    }
}
