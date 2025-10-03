namespace CVDocumentParser.API.Configuration
{
    public class ParsingConfiguration
    {
        public const string SectionName = "ParsingConfiguration";
        
        public double NameConfidenceThreshold { get; set; } = 0.7;
        public int MinDescriptionLength { get; set; } = 10;
        public int MaxCandidateLines { get; set; } = 20;
        public int MaxFileSize { get; set; } = 10 * 1024 * 1024; // 10MB
        
        public string[] AllowedExtensions { get; set; } = { ".pdf", ".docx", ".doc" };
        
        public string[] JobTitleKeywords { get; set; } = 
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
        
        public string[] NonNamePatterns { get; set; } = 
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
    }
}
