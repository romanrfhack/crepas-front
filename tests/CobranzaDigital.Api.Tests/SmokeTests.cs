using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace CobranzaDigital.Api.Tests;

public sealed class CobranzaDigitalApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((context, config) =>
        {
            var settings = new Dictionary<string, string?>
            {
                ["ConnectionStrings:SqlServer"] =
                    "Server=(localdb)\\MSSQLLocalDB;Database=CobranzaDigitalTests;Trusted_Connection=True;MultipleActiveResultSets=true",
                ["DatabaseOptions:ConnectionStringName"] = "SqlServer"
            };

            config.AddInMemoryCollection(settings);
        });
    }
}

public sealed class SmokeTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly HttpClient _client;

    public SmokeTests(CobranzaDigitalApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task LiveHealth_ReturnsOk()
    {
        var response = await _client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/v1/authorization/protected");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
