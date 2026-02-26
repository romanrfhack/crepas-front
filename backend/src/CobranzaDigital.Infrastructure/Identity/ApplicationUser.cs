using Microsoft.AspNetCore.Identity;

namespace CobranzaDigital.Infrastructure.Identity;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public Guid? TenantId { get; set; }
    public Guid? StoreId { get; set; }
}
