using CVDocumentParser.API.Models;
using CVDocumentParser.API.Utilities;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using DocumentFormat.OpenXml;

namespace CVDocumentParser.API.Services
{
    public class WordParsingService : IDocumentParsingService
    {
        public bool CanParse(string fileName)
        {
            var extension = Path.GetExtension(fileName).ToLowerInvariant();
            return extension == ".docx" || extension == ".doc";
        }

        public string GetSupportedFileExtensions()
        {
            return ".docx, .doc";
        }

        public async Task<ParsedCVData> ParseDocumentAsync(Stream documentStream, string fileName)
        {
            try
            {
                var extractedText = await ExtractTextFromWordAsync(documentStream);
                var parsedData = TextExtractionHelpers.ParseCVText(extractedText, fileName);
                
                parsedData.OriginalFileName = fileName;
                parsedData.DocumentType = "Word Document";
                
                return parsedData;
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Failed to parse Word document: {ex.Message}", ex);
            }
        }

        private Task<string> ExtractTextFromWordAsync(Stream wordStream)
        {
            try
            {
                using var wordDoc = WordprocessingDocument.Open(wordStream, false);
                var mainPart = wordDoc.MainDocumentPart;
                
                if (mainPart == null)
                    return Task.FromResult(string.Empty);

                var text = string.Empty;
                
                // Extract text from main document body (paragraphs) - preserve complete bullet point text
                var body = mainPart.Document?.Body;
                if (body != null)
                {
                    foreach (var paragraph in body.Elements<Paragraph>())
                    {
                        var paragraphText = "";
                        
                        // Check if this paragraph has numbering (bullet points/lists)
                        var paragraphProperties = paragraph.Elements<ParagraphProperties>().FirstOrDefault();
                        var hasNumbering = paragraphProperties?.NumberingProperties != null;
                        
                        // Extract all text content from the paragraph using InnerText first
                        var rawParagraphText = paragraph.InnerText;
                        
                        if (!string.IsNullOrWhiteSpace(rawParagraphText))
                        {
                            // Use the complete InnerText which preserves all characters
                            paragraphText = rawParagraphText;
                            
                            // Debug logging to see what we're extracting
                            Console.WriteLine($"[DEBUG] Raw paragraph text: '{rawParagraphText}'");
                            
                            text += paragraphText + "\n";
                        }
                    }
                    
                    // Extract text from tables - preserve complete text including bullet points
                    foreach (var table in body.Elements<Table>())
                    {
                        foreach (var row in table.Elements<TableRow>())
                        {
                            foreach (var cell in row.Elements<TableCell>())
                            {
                                foreach (var paragraph in cell.Elements<Paragraph>())
                                {
                                    var cellParagraphText = "";
                                    var runs = paragraph.Elements<Run>().ToList();
                                    for (int runIndex = 0; runIndex < runs.Count; runIndex++)
                                    {
                                        var run = runs[runIndex];
                                        var runText = "";
                                        
                                        foreach (var textElement in run.Elements<Text>())
                                        {
                                            var elementText = textElement.Text;
                                            
                                            // Check for xml:space="preserve" attribute
                                            if (textElement.Space != null && textElement.Space.Value == SpaceProcessingModeValues.Preserve)
                                            {
                                                // Preserve all spaces as-is
                                                runText += elementText;
                                            }
                                            else
                                            {
                                                // Standard text - ensure proper spacing
                                                runText += elementText;
                                            }
                                        }
                                        
                                        cellParagraphText += runText;
                                        
                                        // Add space between runs if the current run doesn't end with space 
                                        // and the next run doesn't start with space
                                        if (runIndex < runs.Count - 1 && !string.IsNullOrEmpty(runText))
                                        {
                                            var nextRun = runs[runIndex + 1];
                                            var nextRunText = "";
                                            foreach (var textElement in nextRun.Elements<Text>())
                                            {
                                                nextRunText += textElement.Text;
                                            }
                                            
                                            // Only add space if current doesn't end with space and next doesn't start with space
                                            if (!runText.EndsWith(" ") && !string.IsNullOrEmpty(nextRunText) && !nextRunText.StartsWith(" "))
                                            {
                                                cellParagraphText += " ";
                                            }
                                        }
                                    }
                                    
                                    // Add the complete paragraph text if it's not empty
                                    if (!string.IsNullOrWhiteSpace(cellParagraphText))
                                    {
                                        text += cellParagraphText + "\n";
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Extract text from text boxes and shapes (this is key for your CV!)
                text += ExtractTextFromTextBoxes(mainPart);
                
                // Also check headers and footers for text boxes
                foreach (var headerPart in mainPart.HeaderParts)
                {
                    text += ExtractTextFromTextBoxes(headerPart);
                }
                
                foreach (var footerPart in mainPart.FooterParts)
                {
                    text += ExtractTextFromTextBoxes(footerPart);
                }
                
                return Task.FromResult(text);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Error extracting text from Word document: {ex.Message}", ex);
            }
        }

        private string ExtractTextFromTextBoxes(OpenXmlPart part)
        {
            var text = string.Empty;
            
            try
            {
                var root = part.RootElement;
                if (root == null) return text;

                // Look for text boxes in shapes
                var textBoxes = root.Descendants().Where(d => d.LocalName == "txbxContent");
                
                foreach (var textBox in textBoxes)
                {
                    // Extract paragraphs from text boxes
                    foreach (var paragraph in textBox.Elements<Paragraph>())
                    {
                        var paragraphText = "";
                        var runs = paragraph.Elements<Run>().ToList();
                        for (int runIndex = 0; runIndex < runs.Count; runIndex++)
                        {
                            var run = runs[runIndex];
                            var runText = "";
                            
                            foreach (var textElement in run.Elements<Text>())
                            {
                                var elementText = textElement.Text;
                                
                                // Check for xml:space="preserve" attribute
                                if (textElement.Space != null && textElement.Space.Value == SpaceProcessingModeValues.Preserve)
                                {
                                    // Preserve all spaces as-is
                                    runText += elementText;
                                }
                                else
                                {
                                    // Standard text - ensure proper spacing
                                    runText += elementText;
                                }
                            }
                            
                            paragraphText += runText;
                            
                            // Add space between runs if the current run doesn't end with space 
                            // and the next run doesn't start with space
                            if (runIndex < runs.Count - 1 && !string.IsNullOrEmpty(runText))
                            {
                                var nextRun = runs[runIndex + 1];
                                var nextRunText = "";
                                foreach (var textElement in nextRun.Elements<Text>())
                                {
                                    nextRunText += textElement.Text;
                                }
                                
                                // Only add space if current doesn't end with space and next doesn't start with space
                                if (!runText.EndsWith(" ") && !string.IsNullOrEmpty(nextRunText) && !nextRunText.StartsWith(" "))
                                {
                                    paragraphText += " ";
                                }
                            }
                        }
                        text += paragraphText + "\n";
                    }
                }

                // Also look for drawing elements that might contain text
                var drawings = root.Descendants().Where(d => d.LocalName == "drawing");
                foreach (var drawing in drawings)
                {
                    var textBodies = drawing.Descendants().Where(d => d.LocalName == "txBody");
                    foreach (var textBody in textBodies)
                    {
                        var paragraphs = textBody.Descendants().Where(d => d.LocalName == "p");
                        foreach (var para in paragraphs)
                        {
                            var textRuns = para.Descendants().Where(d => d.LocalName == "t");
                            foreach (var textRun in textRuns)
                            {
                                text += textRun.InnerText;
                            }
                            text += "\n";
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DEBUG] Error extracting text from text boxes: {ex.Message}");
            }
            
            return text;
        }
    }
}
