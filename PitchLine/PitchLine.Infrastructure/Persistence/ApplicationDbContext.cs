using Microsoft.EntityFrameworkCore;
using PitchLine.Application.Common.Interfaces;

namespace PitchLine.Infrastructure.Persistence;

public sealed class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }
}
