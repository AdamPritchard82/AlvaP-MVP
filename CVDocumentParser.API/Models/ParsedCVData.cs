namespace CVDocumentParser.API.Models
{
    public class ParsedCVData
    {
        public PersonalInfo PersonalInfo { get; set; } = new PersonalInfo();
        public List<WorkExperience> WorkExperience { get; set; } = new List<WorkExperience>();
        public List<Education> Education { get; set; } = new List<Education>();
        public List<string> Skills { get; set; } = new List<string>();
        public List<string> Languages { get; set; } = new List<string>();
        public List<string> Certifications { get; set; } = new List<string>();
        public string? Summary { get; set; }
        public DateTime ParsedAt { get; set; } = DateTime.UtcNow;
        public string? OriginalFileName { get; set; }
        public string? DocumentType { get; set; }
    }
}
