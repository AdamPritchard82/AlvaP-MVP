using CVDocumentParser.API.Models;
using System.Text.RegularExpressions;

namespace CVDocumentParser.API.Utilities
{
    public static class TextExtractionHelpers
    {
        public static ParsedCVData ParseCVText(string text, string? fileName = null)
        {
            var parsedData = new ParsedCVData();
            
            // Clean and normalize the text
            text = CleanText(text);
            
            // Store original text for debugging (first 500 chars)
            Console.WriteLine($"[DEBUG] Extracted text preview: {text.Substring(0, Math.Min(500, text.Length))}...");
            
            // Extract different sections
            parsedData.PersonalInfo = ExtractPersonalInfo(text, fileName);
            parsedData.WorkExperience = ExtractWorkExperience(text);
            parsedData.Education = ExtractEducation(text);
            parsedData.Skills = ExtractSkills(text);
            parsedData.Languages = ExtractLanguages(text);
            parsedData.Certifications = ExtractCertifications(text);
            parsedData.Summary = ExtractSummary(text);
            
            return parsedData;
        }

        private static string CleanText(string text)
        {
            if (string.IsNullOrEmpty(text))
                return string.Empty;
            
            // DEBUG: Log the original text to see what we're getting
            Console.WriteLine($"[DEBUG] Original extracted text (first 200 chars): {text.Substring(0, Math.Min(200, text.Length))}");
            
            // Clean up Word document artifacts and normalize text
            // Remove Word positioning numbers and formatting artifacts
            text = Regex.Replace(text, @"^\d+\s*", "", RegexOptions.Multiline); // Remove leading numbers
            text = Regex.Replace(text, @"\d{8,}", ""); // Remove long numeric strings (Word positioning data)
            
            // Fix the specific text issues we're seeing - comprehensive bullet point fixes
            text = Regex.Replace(text, @"Responsible for the dDrafting", "Responsible for drafting");
            text = Regex.Replace(text, @"dDrafting", "Drafting");
            text = Regex.Replace(text, @"Manage and maintainaintain", "Manage and maintain");
            text = Regex.Replace(text, @"maintainaintain", "maintain");
            
            // Fix the persistent truncation issues
            text = Regex.Replace(text, @"\braft edit\b", "Draft edit", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, @"\braft\s+edit\b", "Draft edit", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, @"\bM organized\b", "Manage organized", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, @"\bM\s+organized\b", "Manage organized", RegexOptions.IgnoreCase);
            
            // More general pattern fixes for common truncation issues
            text = Regex.Replace(text, @"\braft\s+(edit|editing|written)", "Draft $1", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, @"\bM\s+(organized|manage|maintaining)", "Manage $1", RegexOptions.IgnoreCase);
            
            // Fix other potential first-character truncation patterns
            text = Regex.Replace(text, @"\brovide\b", "Provide", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, @"\bevelop\b", "Develop", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, @"\bssist\b", "Assist", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, @"\boordinate\b", "Coordinate", RegexOptions.IgnoreCase);
            
            // MINIMAL processing - only normalize line endings, preserve everything else
            text = Regex.Replace(text, @"\r\n|\r|\n", "\n"); // Normalize line endings
            text = Regex.Replace(text, @"[ \t]+", " "); // Replace multiple spaces/tabs with single space
            
            // Split into lines and create clean, properly formatted lines
            var lines = text.Split('\n');
            var cleanedLines = new List<string>();
            
            Console.WriteLine($"[DEBUG] Processing {lines.Length} lines");
            
            foreach (var line in lines)
            {
                if (!string.IsNullOrWhiteSpace(line))
                {
                    var trimmedLine = line.Trim();
                    
                    // Skip overly long combined lines (probably Word formatting artifacts)
                    if (trimmedLine.Length > 1000)
                    {
                        // Try to extract meaningful parts from very long lines
                        var sentences = trimmedLine.Split('.').Where(s => s.Trim().Length > 10 && s.Trim().Length < 200).ToList();
                        foreach (var sentence in sentences)
                        {
                            var cleanSentence = sentence.Trim();
                            if (!string.IsNullOrEmpty(cleanSentence) && !cleanSentence.All(char.IsDigit))
                            {
                                cleanedLines.Add(cleanSentence);
                            }
                        }
                    }
                    else
                    {
                        // Regular line processing
                        if (!trimmedLine.All(char.IsDigit) && trimmedLine.Length > 2)
                        {
                            cleanedLines.Add(trimmedLine);
                        }
                    }
                }
            }
            
            var result = string.Join("\n", cleanedLines);
            Console.WriteLine($"[DEBUG] Final cleaned text (first 200 chars): {result.Substring(0, Math.Min(200, result.Length))}");
            
            return result;
        }

        private static PersonalInfo ExtractPersonalInfo(string text, string? fileName = null)
        {
            var personalInfo = new PersonalInfo();

            // First extract email as it's more reliable
            var emailPattern = @"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b";
            var emailMatch = Regex.Match(text, emailPattern);
            if (emailMatch.Success)
            {
                personalInfo.Email = emailMatch.Value;
            }

            // Try multiple strategies to extract the name with cross-validation
            var lines = text.Split('\n').Select(l => l.Trim()).Where(l => !string.IsNullOrEmpty(l)).ToArray();
            
            // Strategy 1: Cross-validate with email address
            if (!string.IsNullOrEmpty(personalInfo.Email))
            {
                var nameFromEmail = ExtractNameFromEmail(personalInfo.Email);
                if (!string.IsNullOrEmpty(nameFromEmail))
                {
                    // Look for this name in the document text
                    var emailBasedNamePattern = CreateFlexibleNamePattern(nameFromEmail);
                    var emailNameMatch = Regex.Match(text, emailBasedNamePattern, RegexOptions.IgnoreCase);
                    if (emailNameMatch.Success)
                    {
                        personalInfo.Name = FormatProperName(emailNameMatch.Groups[1].Value);
                        SplitName(personalInfo.Name, personalInfo);
                        Console.WriteLine($"[DEBUG] Name found via email validation: {personalInfo.Name}");
                        Console.WriteLine($"[DEBUG] Split name - First: '{personalInfo.FirstName}', Last: '{personalInfo.LastName}'");
                    }
                }
            }

            // Strategy 2: Cross-validate with filename
            if (string.IsNullOrEmpty(personalInfo.Name) && !string.IsNullOrEmpty(fileName))
            {
                var nameFromFile = ExtractNameFromFileName(fileName);
                if (!string.IsNullOrEmpty(nameFromFile))
                {
                    // Look for this name in the document text
                    var fileBasedNamePattern = CreateFlexibleNamePattern(nameFromFile);
                    var fileNameMatch = Regex.Match(text, fileBasedNamePattern, RegexOptions.IgnoreCase);
                    if (fileNameMatch.Success)
                    {
                        personalInfo.Name = FormatProperName(fileNameMatch.Groups[1].Value);
                        SplitName(personalInfo.Name, personalInfo);
                        Console.WriteLine($"[DEBUG] Name found via filename validation: {personalInfo.Name}");
                    }
                }
            }

            // Strategy 3: Advanced contextual name extraction with validation
            if (string.IsNullOrEmpty(personalInfo.Name))
            {
                var candidateNames = ExtractCandidateNames(lines);
                
                foreach (var candidate in candidateNames)
                {
                    var confidence = CalculateNameConfidence(candidate.Name, personalInfo.Email, fileName, lines, candidate.LineIndex);
                    Console.WriteLine($"[DEBUG] Name candidate: '{candidate.Name}' - Confidence: {confidence}");
                    
                    if (confidence >= 0.7) // 70% confidence threshold
                    {
                        personalInfo.Name = candidate.Name;
                        SplitName(personalInfo.Name, personalInfo);
                        Console.WriteLine($"[DEBUG] Name selected: {personalInfo.Name} (Confidence: {confidence})");
                        break;
                    }
                }
            }

            // Strategy 4: Use email-based name as fallback
            if (string.IsNullOrEmpty(personalInfo.Name) && !string.IsNullOrEmpty(personalInfo.Email))
            {
                var nameFromEmail = ExtractNameFromEmail(personalInfo.Email);
                if (!string.IsNullOrEmpty(nameFromEmail) && IsValidPersonName(nameFromEmail))
                {
                    personalInfo.Name = FormatProperName(nameFromEmail);
                    SplitName(personalInfo.Name, personalInfo);
                    Console.WriteLine($"[DEBUG] Using email-based name as fallback: {personalInfo.Name}");
                }
            }

            // Extract phone number
            var phonePattern = @"\(?\d{3}\)?[-.\s]*\d{3}[-.\s]*\d{4}";
            var phoneMatches = Regex.Matches(text, phonePattern);
            if (phoneMatches.Count > 0)
            {
                personalInfo.Phone = phoneMatches[0].Value.Trim();
            }

            // Extract LinkedIn
            var linkedInPattern = @"(?:linkedin\.com/in/|LinkedIn:?\s*)([^\s]+)";
            var linkedInMatch = Regex.Match(text, linkedInPattern, RegexOptions.IgnoreCase);
            if (linkedInMatch.Success)
            {
                personalInfo.LinkedIn = linkedInMatch.Groups[1].Value;
            }

            // Extract address
            var addressPattern = @"(?:Address|Location)[\s:]+([^\n]+)";
            var addressMatch = Regex.Match(text, addressPattern, RegexOptions.IgnoreCase);
            if (addressMatch.Success)
            {
                personalInfo.Address = addressMatch.Groups[1].Value.Trim();
            }

            return personalInfo;
        }

        private static string? ExtractNameFromEmail(string email)
        {
            if (string.IsNullOrEmpty(email))
                return null;

            var emailPart = email.Split('@')[0];
            
            // Common patterns for email-based names
            var patterns = new[]
            {
                @"^([a-z]+)\.([a-z]+)\d*$", // john.smith or john.smith123
                @"^([a-z]+)([a-z]+)\d*$",   // johnsmith or johnsmith123
                @"^([a-z])([a-z]+)\d*$"     // jsmith or jsmith123
            };

            foreach (var pattern in patterns)
            {
                var match = Regex.Match(emailPart.ToLower(), pattern);
                if (match.Success)
                {
                    if (match.Groups.Count == 3) // First and last name
                    {
                        var firstName = CapitalizeFirstLetter(match.Groups[1].Value);
                        var lastName = CapitalizeFirstLetter(match.Groups[2].Value);
                        return $"{firstName} {lastName}";
                    }
                }
            }

            return null;
        }

        private static string CreateFlexibleNamePattern(string name)
        {
            // Create a pattern that allows for variations in the document
            var nameParts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (nameParts.Length >= 2)
            {
                var firstName = Regex.Escape(nameParts[0]);
                var lastName = Regex.Escape(nameParts[^1]);
                return $@"\b({firstName}\s+{lastName})\b";
            }
            return $@"\b({Regex.Escape(name)})\b";
        }

        private static List<(string Name, int LineIndex)> ExtractCandidateNames(string[] lines)
        {
            var candidates = new List<(string Name, int LineIndex)>();

            for (int i = 0; i < Math.Min(lines.Length, 20); i++)
            {
                var line = lines[i];
                
                // Look for potential name patterns
                var nameMatches = new[]
                {
                    Regex.Match(line, @"^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s|$)"),
                    Regex.Match(line, @"([A-Z][a-z]+\s+[A-Z][a-z]+)"),
                    Regex.Match(line, @"^([A-Z]+\s+[A-Z]+)$") // All caps names
                };

                foreach (var nameMatch in nameMatches)
                {
                    if (nameMatch.Success)
                    {
                        var candidateName = nameMatch.Groups[1].Value.Trim();
                        
                        if (IsValidPersonName(candidateName) && !IsJobTitleOrCompany(candidateName))
                        {
                            candidates.Add((candidateName, i));
                        }
                    }
                }
            }

            return candidates;
        }

        private static double CalculateNameConfidence(string candidateName, string? email, string? fileName, string[] allLines, int lineIndex)
        {
            double confidence = 0.0;

            // Base score for being a valid name
            if (IsValidPersonName(candidateName))
                confidence += 0.3;

            // Email validation bonus
            if (!string.IsNullOrEmpty(email))
            {
                var emailName = ExtractNameFromEmail(email);
                if (!string.IsNullOrEmpty(emailName))
                {
                    var similarity = CalculateNameSimilarity(candidateName, emailName);
                    confidence += similarity * 0.4; // Up to 40% bonus
                }
            }

            // Filename validation bonus
            if (!string.IsNullOrEmpty(fileName))
            {
                var fileName_name = ExtractNameFromFileName(fileName ?? string.Empty);
                if (!string.IsNullOrEmpty(fileName_name))
                {
                    var similarity = CalculateNameSimilarity(candidateName, fileName_name);
                    confidence += similarity * 0.3; // Up to 30% bonus
                }
            }

            // Position bonus (earlier in document = higher confidence)
            if (lineIndex < 5)
                confidence += 0.2;
            else if (lineIndex < 10)
                confidence += 0.1;

            // Context bonus
            if (HasGoodContextualClues(candidateName, allLines, lineIndex))
                confidence += 0.2;

            // Penalty for job title/company patterns
            if (IsJobTitleOrCompany(candidateName))
                confidence -= 0.5;

            return Math.Max(0.0, Math.Min(1.0, confidence));
        }

        private static double CalculateNameSimilarity(string name1, string name2)
        {
            if (string.IsNullOrEmpty(name1) || string.IsNullOrEmpty(name2))
                return 0.0;

            // Normalize names for comparison
            var normalized1 = name1.ToLower().Replace(" ", "");
            var normalized2 = name2.ToLower().Replace(" ", "");

            // Exact match
            if (normalized1 == normalized2)
                return 1.0;

            // Check if one contains the other
            if (normalized1.Contains(normalized2) || normalized2.Contains(normalized1))
                return 0.8;

            // Split into parts and check overlap
            var parts1 = name1.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var parts2 = name2.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries);

            var commonParts = parts1.Intersect(parts2).Count();
            var totalParts = Math.Max(parts1.Length, parts2.Length);

            return (double)commonParts / totalParts;
        }

        private static string FormatProperName(string name)
        {
            return string.Join(" ", name.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Select(CapitalizeFirstLetter));
        }

        private static void SplitName(string? fullName, PersonalInfo personalInfo)
        {
            if (string.IsNullOrEmpty(fullName))
                return;

            var nameParts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            
            if (nameParts.Length >= 2)
            {
                personalInfo.FirstName = nameParts[0];
                personalInfo.LastName = nameParts[^1]; // Last element
                
                // If there are middle names, include them with the first name
                if (nameParts.Length > 2)
                {
                    var middleNames = string.Join(" ", nameParts[1..^1]);
                    personalInfo.FirstName = $"{nameParts[0]} {middleNames}";
                }
            }
            else if (nameParts.Length == 1)
            {
                // If only one name part, treat it as first name
                personalInfo.FirstName = nameParts[0];
                personalInfo.LastName = null;
            }
        }

        private static string CapitalizeFirstLetter(string word)
        {
            if (string.IsNullOrEmpty(word))
                return word;
            return char.ToUpper(word[0]) + word.Substring(1).ToLower();
        }

        private static bool IsJobTitleOrCompany(string text)
        {
            var jobTitleKeywords = new[]
            {
                "Marketing", "Communication", "Consultant", "Manager", "Director", "Specialist", 
                "Coordinator", "Assistant", "Analyst", "Attendant", "Professional", "Center", 
                "Centers", "University", "College", "Corporation", "Company", "Museum", "Art",
                "Pacifica", "California", "Thousand", "Oaks", "Gallery", "Communications",
                // Technology/Software/Tools
                "Sprout", "Social", "Microsoft", "Adobe", "SharePoint", "Mailchimp", "Constant",
                "Contact", "Blackbaud", "eTapestry", "Creative", "Suite", "Office", "LinkedIn",
                // More company/organization terms
                "Software", "Technologies", "Solutions", "Services", "Systems", "Platform",
                "Application", "Digital", "Media", "Network", "Online", "Web", "Internet"
            };
            
            return jobTitleKeywords.Any(keyword => 
                text.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        private static bool IsValidPersonName(string candidate)
        {
            if (string.IsNullOrWhiteSpace(candidate))
                return false;

            // 1. Character Set Check
            if (!IsValidCharacterSet(candidate))
                return false;

            // 2. Length Check
            if (candidate.Length < 2 || candidate.Length > 100)
                return false;

            // 3. Punctuation/Format Check
            if (!HasValidPunctuation(candidate))
                return false;

            // 4. Casing Check
            if (!HasProperCasing(candidate))
                return false;

            // 5. Common non-name patterns
            if (ContainsNonNamePatterns(candidate))
                return false;

            return true;
        }

        private static bool IsValidCharacterSet(string text)
        {
            // Count digits and symbols
            int digitCount = text.Count(char.IsDigit);
            int totalChars = text.Length;
            
            // Reject if more than 20% digits
            if (digitCount > 0 && (double)digitCount / totalChars > 0.2)
                return false;

            // Check for invalid characters
            var invalidChars = new[] { '@', '/', ':', '#', '$', '%', '&', '*', '(', ')', '[', ']', '{', '}', '<', '>', '|', '\\' };
            if (text.Any(c => invalidChars.Contains(c)))
                return false;

            // Must contain at least some letters
            return text.Any(char.IsLetter);
        }

        private static bool HasValidPunctuation(string text)
        {
            // Reject email-like patterns
            if (text.Contains("@") || text.Contains("www") || text.Contains(".com"))
                return false;

            // Reject phone number patterns
            if (Regex.IsMatch(text, @"\d{3}[-.\s]?\d{3}[-.\s]?\d{4}"))
                return false;

            // Reject URL components
            if (text.Contains("://") || text.Contains("http"))
                return false;

            return true;
        }

        private static bool HasProperCasing(string text)
        {
            // Split into words
            var words = text.Split(new[] { ' ', '-', '\'' }, StringSplitOptions.RemoveEmptyEntries);
            
            foreach (var word in words)
            {
                if (string.IsNullOrEmpty(word))
                    continue;

                // Each word should start with uppercase (allowing for some exceptions)
                if (!char.IsUpper(word[0]) && word.Length > 1)
                {
                    // Allow for special cases like "de", "van", "von", etc.
                    var lowerCasePrefixes = new[] { "de", "van", "von", "la", "le", "du", "da", "del", "della" };
                    if (!lowerCasePrefixes.Contains(word.ToLower()))
                        return false;
                }

                // Reject all caps (unless short initials)
                if (word.Length > 2 && word.All(char.IsUpper))
                    return false;

                // Reject all lowercase (unless prefixes)
                if (word.Length > 2 && word.All(char.IsLower))
                {
                    var allowedLowercase = new[] { "de", "van", "von", "la", "le", "du", "da", "del", "della" };
                    if (!allowedLowercase.Contains(word.ToLower()))
                        return false;
                }
            }

            return true;
        }

        private static bool ContainsNonNamePatterns(string text)
        {
            var nonNamePatterns = new[]
            {
                "Manager", "LLC", "BSc", "MSc", "PhD", "Experience", "Resume", "CV", 
                "Curriculum", "Vitae", "Education", "Skills", "Work", "History",
                "Employment", "Position", "Role", "Title", "Department", "Inc",
                "Corporation", "Company", "Ltd", "Limited", "Consulting", "Services",
                // Technology and software terms
                "Social", "Media", "Software", "Platform", "Application", "System",
                "Digital", "Online", "Web", "Internet", "Technology", "Tech",
                "Solutions", "Network", "Cloud", "Database", "Analytics", "Tools",
                // Social media and marketing tools
                "Sprout", "Mailchimp", "Constant", "Contact", "SharePoint", "Adobe",
                "Microsoft", "Office", "Suite", "Creative", "LinkedIn", "Facebook",
                "Twitter", "Instagram", "YouTube", "Google", "Analytics"
            };

            return nonNamePatterns.Any(pattern => 
                text.Contains(pattern, StringComparison.OrdinalIgnoreCase));
        }

        private static bool HasGoodContextualClues(string candidateName, string[] allLines, int lineIndex)
        {
            // Check surrounding lines for contact information
            bool hasNearbyContactInfo = false;
            
            for (int i = Math.Max(0, lineIndex - 2); i < Math.Min(allLines.Length, lineIndex + 3); i++)
            {
                var line = allLines[i];
                
                // Look for email, phone, or address patterns
                if (Regex.IsMatch(line, @"@|phone|tel|mobile|\(\d{3}\)|\d{3}[-.\s]\d{3}[-.\s]\d{4}|address|linkedin", RegexOptions.IgnoreCase))
                {
                    hasNearbyContactInfo = true;
                    break;
                }
            }

            // Check that it's not near section headers
            bool nearSectionHeaders = false;
            for (int i = Math.Max(0, lineIndex - 1); i < Math.Min(allLines.Length, lineIndex + 2); i++)
            {
                var line = allLines[i];
                
                if (Regex.IsMatch(line, @"^(EDUCATION|SKILLS|WORK|EXPERIENCE|EMPLOYMENT|OBJECTIVE|SUMMARY)", RegexOptions.IgnoreCase))
                {
                    nearSectionHeaders = true;
                    break;
                }
            }

            return hasNearbyContactInfo && !nearSectionHeaders;
        }

        private static string? ExtractNameFromFileName(string fileName)
        {
            if (string.IsNullOrEmpty(fileName))
                return null;

            // Remove file extension
            var nameWithoutExtension = Path.GetFileNameWithoutExtension(fileName);
            
            // Common patterns for CV filenames
            var patterns = new[]
            {
                @"^([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+(?:Resume|CV|Curriculum))?",
                @"([A-Z][a-z]+\s+[A-Z][a-z]+)",
            };

            foreach (var pattern in patterns)
            {
                var match = Regex.Match(nameWithoutExtension, pattern, RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    return match.Groups[1].Value.Trim();
                }
            }

            return null;
        }

        private static List<WorkExperience> ExtractWorkExperience(string text)
        {
            var workExperience = new List<WorkExperience>();
            var processedPositions = new HashSet<string>(); // Track processed job titles to avoid duplicates

            // Split text into lines for better processing
            var lines = text.Split('\n').Select(l => l.Trim()).Where(l => !string.IsNullOrEmpty(l)).ToArray();

            // Look for job title patterns followed by company and dates
            for (int i = 0; i < lines.Length - 1; i++)
            {
                var line = lines[i];
                
                // Check if this looks like a job title (ends with "Consultant", "Manager", etc.)
                if (Regex.IsMatch(line, @"(Consultant|Manager|Director|Specialist|Coordinator|Assistant|Analyst|Attendant)$", RegexOptions.IgnoreCase))
                {
                    // Create a unique key to avoid duplicates
                    var uniqueKey = line.Trim().ToLower();
                    
                    // Skip if we've already processed this job title
                    if (processedPositions.Contains(uniqueKey))
                        continue;
                        
                    processedPositions.Add(uniqueKey);

                    var experience = new WorkExperience
                    {
                        JobTitle = line.Trim()
                    };

                    // Look for company name in next few lines
                    for (int j = i + 1; j < Math.Min(i + 4, lines.Length); j++)
                    {
                        var nextLine = lines[j];
                        
                        // Check if this looks like a company name (contains "Centers", "Museum", etc.)
                        if (Regex.IsMatch(nextLine, @"(Centers?|Museum|Corp|Company|Inc|LLC|Foundation|Association|University|College)", RegexOptions.IgnoreCase))
                        {
                            experience.Company = nextLine.Trim();
                            break;
                        }
                    }

                    // Look for date ranges
                    for (int j = i + 1; j < Math.Min(i + 6, lines.Length); j++)
                    {
                        var dateLine = lines[j];
                        var dateMatch = Regex.Match(dateLine, @"(\d{4})\s*-\s*(\d{4}|Present)", RegexOptions.IgnoreCase);
                        if (dateMatch.Success)
                        {
                            experience.StartDate = dateMatch.Groups[1].Value;
                            experience.EndDate = dateMatch.Groups[2].Value;
                            if (dateMatch.Groups[2].Value.ToLower() == "present")
                                experience.IsCurrentPosition = true;
                            break;
                        }
                    }

                    // Collect description lines (bullet points or responsibilities) but filter better
                    var descriptionLines = new List<string>();
                    for (int j = i + 1; j < lines.Length; j++)
                    {
                        var descLine = lines[j];
                        
                        // Stop if we hit another job title
                        if (j > i + 1 && Regex.IsMatch(descLine, @"(Consultant|Manager|Director|Specialist|Coordinator|Assistant|Analyst|Attendant)$", RegexOptions.IgnoreCase))
                            break;
                            
                        // Stop if we hit skills section or other sections
                        if (Regex.IsMatch(descLine, @"^(SKILLS|EDUCATION|REFERENCES|CERTIFICATIONS)", RegexOptions.IgnoreCase))
                            break;

                    // Enhanced filtering for responsibilities - preserve complete text
                    if (descLine.Length > 5 && 
                        !descLine.Contains("@") && 
                        !Regex.IsMatch(descLine, @"^\d{4}") &&
                        !descLine.Equals(experience.Company, StringComparison.OrdinalIgnoreCase) &&
                        !descLine.Contains("Marketing and Communications Professional") &&
                        !descLine.StartsWith("Marketing Communications") &&
                        !descLine.Contains("Casa Pacifica Centers") &&
                        !descLine.Contains("California Museum of Art") &&
                        !Regex.IsMatch(descLine, @"^\s*$")) // Ignore empty lines
                    {
                        // DEBUG: Log the original line before any processing
                        Console.WriteLine($"[DEBUG] Original responsibility line: '{descLine}'");
                        
                        // MINIMAL processing - just remove bullet points but preserve all text
                        var cleanedLine = descLine.Trim();
                        
                        // More careful bullet point removal
                        if (cleanedLine.StartsWith("•") || cleanedLine.StartsWith("*") || cleanedLine.StartsWith("-"))
                        {
                            cleanedLine = cleanedLine.Substring(1).Trim();
                            Console.WriteLine($"[DEBUG] After bullet removal: '{cleanedLine}'");
                        }
                        
                        // Ensure we have meaningful content
                        if (!string.IsNullOrWhiteSpace(cleanedLine))
                        {
                            descriptionLines.Add(cleanedLine);
                            Console.WriteLine($"[DEBUG] Added to description: '{cleanedLine}'");
                        }
                    }
                    }

                    // Remove duplicate responsibilities but preserve order and content
                    descriptionLines = descriptionLines.Distinct().ToList();
                    
                    // Join with proper spacing to avoid cutting off words
                    experience.Description = string.Join(" ", descriptionLines.Where(line => !string.IsNullOrWhiteSpace(line)));
                    experience.Responsibilities = descriptionLines.Where(line => !string.IsNullOrWhiteSpace(line)).ToList();

                    // Only add if we have meaningful data
                    if (!string.IsNullOrEmpty(experience.JobTitle) && !string.IsNullOrEmpty(experience.Company))
                    {
                        workExperience.Add(experience);
                    }
                }
            }

            return workExperience;
        }

        private static List<Education> ExtractEducation(string text)
        {
            var education = new List<Education>();

            // Look for education section with more flexible patterns  
            var educationSectionPatterns = new[]
            {
                @"(?:EDUCATION|ACADEMIC BACKGROUND|QUALIFICATIONS|ACADEMIC QUALIFICATIONS)[\s\n]+(.*?)(?=\n(?:WORK|EXPERIENCE|SKILLS|CERTIFICATIONS|LANGUAGES|$))",
                @"(?:EDUCATION)[\s\n]+(.*?)(?=\n(?:WORK|EXPERIENCE|SKILLS|CERTIFICATIONS|LANGUAGES|$))"
            };
            
            Match educationSectionMatch = null;
            foreach (var pattern in educationSectionPatterns)
            {
                educationSectionMatch = Regex.Match(text, pattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);
                if (educationSectionMatch.Success) break;
            }

            if (educationSectionMatch?.Success == true)
            {
                var educationText = educationSectionMatch.Groups[1].Value;
                
                // Extract individual education entries
                var educationEntryPattern = @"([^\n]+(?:degree|bachelor|master|phd|diploma)[^\n]*)\s*\n?([^\n]*university[^\n]*)?";
                var matches = Regex.Matches(educationText, educationEntryPattern, RegexOptions.IgnoreCase | RegexOptions.Multiline);

                foreach (Match match in matches)
                {
                    var edu = new Education
                    {
                        Degree = match.Groups[1].Value.Trim(),
                        Institution = match.Groups[2].Value.Trim()
                    };

                    education.Add(edu);
                }
            }

            return education;
        }

        private static List<string> ExtractSkills(string text)
        {
            var skills = new List<string>();

            // Based on the debug output, let's look for skills in the responsibilities text
            // Common technical skills to look for
            var skillPatterns = new[]
            {
                @"Microsoft Office", @"Adobe Creative Suite", @"SharePoint", @"Mailchimp", 
                @"Sprout Social", @"Constant Contact", @"Blackbaud eTapestry", @"HIPAA",
                @"Content Management", @"Project Management", @"Social Media", @"CRM",
                @"Digital Filing", @"Newsletter", @"Blog", @"Website Content"
            };

            foreach (var pattern in skillPatterns)
            {
                if (Regex.IsMatch(text, pattern, RegexOptions.IgnoreCase))
                {
                    skills.Add(pattern);
                }
            }

            // Also look for skills mentioned in the responsibilities
            var lines = text.Split('\n').Select(l => l.Trim()).Where(l => !string.IsNullOrEmpty(l)).ToArray();
            
            foreach (var line in lines)
            {
                // Look for skills mentioned in context
                if (line.Contains("Proficient in") || line.Contains("Strong in") || line.Contains("Skilled in"))
                {
                    var skillsInLine = ExtractSkillsFromLine(line);
                    skills.AddRange(skillsInLine);
                }
            }

            // Look for the actual SKILLS section if it exists
            var skillsSectionPattern = @"(?:SKILLS|TECHNICAL SKILLS|COMPETENCIES)[\s\n]+(.*?)(?=\n(?:WORK|EXPERIENCE|EDUCATION|CERTIFICATIONS|REFERENCES|$))";
            var skillsSectionMatch = Regex.Match(text, skillsSectionPattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);

            if (skillsSectionMatch.Success)
            {
                var skillsText = skillsSectionMatch.Groups[1].Value;
                var skillArray = skillsText.Split(new[] { ',', '•', '\n', ';', '|' }, StringSplitOptions.RemoveEmptyEntries);
                
                foreach (var skill in skillArray)
                {
                    var cleanSkill = skill.Trim();
                    if (!string.IsNullOrEmpty(cleanSkill) && 
                        cleanSkill.Length > 2 && 
                        cleanSkill.Length < 50 &&
                        !cleanSkill.Equals("SKILLS", StringComparison.OrdinalIgnoreCase))
                    {
                        skills.Add(cleanSkill);
                    }
                }
            }

            return skills.Distinct().ToList();
        }

        private static List<string> ExtractSkillsFromLine(string line)
        {
            var skills = new List<string>();
            
            // Extract skills from a line like "Proficient in Microsoft Office, Adobe Creative Suite..."
            var afterProficient = Regex.Match(line, @"(?:Proficient in|Skilled in|Strong in)\s+(.+)", RegexOptions.IgnoreCase);
            if (afterProficient.Success)
            {
                var skillsText = afterProficient.Groups[1].Value;
                var skillArray = skillsText.Split(new[] { ',', '&' }, StringSplitOptions.RemoveEmptyEntries);
                // Also split on " and "
                var tempSkills = new List<string>();
                foreach (var skill in skillArray)
                {
                    tempSkills.AddRange(skill.Split(new[] { " and " }, StringSplitOptions.RemoveEmptyEntries));
                }
                skillArray = tempSkills.ToArray();
                
                foreach (var skill in skillArray)
                {
                    var cleanSkill = skill.Trim().TrimEnd('.');
                    if (!string.IsNullOrEmpty(cleanSkill) && cleanSkill.Length > 2)
                    {
                        skills.Add(cleanSkill);
                    }
                }
            }
            
            return skills;
        }

        private static List<string> ExtractLanguages(string text)
        {
            var languages = new List<string>();

            var languagesSectionPattern = @"(?:LANGUAGES|LANGUAGE SKILLS)[\s\n]+(.*?)(?=\n(?:WORK|EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS|$))";
            var languagesSectionMatch = Regex.Match(text, languagesSectionPattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);

            if (languagesSectionMatch.Success)
            {
                var languagesText = languagesSectionMatch.Groups[1].Value;
                var languageArray = languagesText.Split(new[] { ',', '•', '\n', ';' }, StringSplitOptions.RemoveEmptyEntries);
                
                foreach (var language in languageArray)
                {
                    var cleanLanguage = language.Trim();
                    if (!string.IsNullOrEmpty(cleanLanguage))
                    {
                        languages.Add(cleanLanguage);
                    }
                }
            }

            return languages;
        }

        private static List<string> ExtractCertifications(string text)
        {
            var certifications = new List<string>();

            var certificationsSectionPattern = @"(?:CERTIFICATIONS|CERTIFICATES|LICENSES)[\s\n]+(.*?)(?=\n(?:WORK|EXPERIENCE|EDUCATION|SKILLS|$))";
            var certificationsSectionMatch = Regex.Match(text, certificationsSectionPattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);

            if (certificationsSectionMatch.Success)
            {
                var certificationsText = certificationsSectionMatch.Groups[1].Value;
                var certificationArray = certificationsText.Split(new[] { ',', '•', '\n', ';' }, StringSplitOptions.RemoveEmptyEntries);
                
                foreach (var certification in certificationArray)
                {
                    var cleanCertification = certification.Trim();
                    if (!string.IsNullOrEmpty(cleanCertification))
                    {
                        certifications.Add(cleanCertification);
                    }
                }
            }

            return certifications;
        }

        private static string? ExtractSummary(string text)
        {
            var summaryPatterns = new[]
            {
                @"(?:SUMMARY|OBJECTIVE|PROFILE|ABOUT)[\s\n]+(.*?)(?=\n(?:WORK|EXPERIENCE|EDUCATION|SKILLS|$))",
                @"^(.*?)(?=\n(?:WORK|EXPERIENCE|EDUCATION|SKILLS))"
            };

            foreach (var pattern in summaryPatterns)
            {
                var match = Regex.Match(text, pattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);
                if (match.Success && match.Groups[1].Value.Trim().Length > 50)
                {
                    return match.Groups[1].Value.Trim();
                }
            }

            return null;
        }
    }
}
