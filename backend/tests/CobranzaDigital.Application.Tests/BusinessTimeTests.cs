using CobranzaDigital.Infrastructure.Services;
using Xunit;

namespace CobranzaDigital.Application.Tests;

public sealed class BusinessTimeTests
{
    [Fact]
    public void ToBusinessDate_UsesAmericaMexicoCityBoundary()
    {
        var businessTime = new BusinessTime();
        var utcNearMidnight = new DateTimeOffset(2026, 01, 20, 05, 30, 00, TimeSpan.Zero);

        var businessDate = businessTime.ToBusinessDate(utcNearMidnight);

        Assert.Equal(new DateOnly(2026, 01, 19), businessDate);
    }
}
