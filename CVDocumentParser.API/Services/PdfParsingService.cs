using CVDocumentParser.API.Models;
using CVDocumentParser.API.Utilities;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Listener;

namespace CVDocumentParser.API.Services
{
    public class PdfParsingService : IDocumentParsingService
    {
        public bool CanParse(string fileName)
        {
            return Path.GetExtension(fileName).ToLowerInvariant() == ".pdf";
        }

        public string GetSupportedFileExtensions()
        {
            return ".pdf";
        }

        public async Task<ParsedCVData> ParseDocumentAsync(Stream documentStream, string fileName)
        {
            try
            {
                var extractedText = await ExtractTextFromPdfAsync(documentStream);
                var parsedData = TextExtractionHelpers.ParseCVText(extractedText, fileName);
                
                parsedData.OriginalFileName = fileName;
                parsedData.DocumentType = "PDF";
                
                return parsedData;
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Failed to parse PDF document: {ex.Message}", ex);
            }
        }

        private async Task<string> ExtractTextFromPdfAsync(Stream pdfStream)
        {
            return await Task.Run(() =>
            {
                using var pdfReader = new PdfReader(pdfStream);
                using var pdfDocument = new PdfDocument(pdfReader);
                
                var text = string.Empty;
                
                for (int pageNum = 1; pageNum <= pdfDocument.GetNumberOfPages(); pageNum++)
                {
                    var page = pdfDocument.GetPage(pageNum);
                    var strategy = new SimpleTextExtractionStrategy();
                    var pageText = PdfTextExtractor.GetTextFromPage(page, strategy);
                    text += pageText + "\n";
                }
                
                return text;
            });
        }
    }
}
