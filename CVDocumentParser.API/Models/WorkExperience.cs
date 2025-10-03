namespace CVDocumentParser.API.Models
{
    public class WorkExperience
    {
        public string? JobTitle { get; set; }
        public string? Company { get; set; }
        public string? StartDate { get; set; }
        public string? EndDate { get; set; }
        public string? Description { get; set; }
        public List<string> Responsibilities { get; set; } = new List<string>();
        public bool IsCurrentPosition { get; set; }
    }
}
