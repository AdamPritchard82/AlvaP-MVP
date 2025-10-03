namespace CVDocumentParser.API.Models
{
    public class Education
    {
        public string? Degree { get; set; }
        public string? Field { get; set; }
        public string? Institution { get; set; }
        public string? StartDate { get; set; }
        public string? EndDate { get; set; }
        public string? GPA { get; set; }
        public string? Description { get; set; }
        public List<string> Honors { get; set; } = new List<string>();
    }
}
