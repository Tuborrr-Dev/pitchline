using System.ComponentModel.DataAnnotations;

namespace Pitchline.MatchEngine.Models;

public class Match
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(64)]
    public string TxlineFixtureId { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string TeamAName { get; set; } = null!;

    [Required]
    [MaxLength(8)]
    public string TeamACode { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string TeamBName { get; set; } = null!;

    [Required]
    [MaxLength(8)]
    public string TeamBCode { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Competition { get; set; } = null!;

    public DateTimeOffset KickoffUtc { get; set; }

    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "scheduled";

    public short CurrentScoreA { get; set; }

    public short CurrentScoreB { get; set; }

    public decimal? FinalProbA { get; set; }

    public decimal? FinalProbDraw { get; set; }

    public decimal? FinalProbB { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<MatchEvent> MatchEvents { get; set; } = new List<MatchEvent>();
}