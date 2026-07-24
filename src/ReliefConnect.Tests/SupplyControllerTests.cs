using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using ReliefConnect.API.Controllers;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.Tests;

public class SupplyControllerTests
{
    [Fact]
    public async Task UpdateSupply_updates_existing_coordinates_when_both_values_are_provided()
    {
        await using var context = CreateContext();
        var supply = CreateSupply();
        context.SupplyItems.Add(supply);
        await context.SaveChangesAsync();
        var controller = CreateController(context);

        var result = await controller.UpdateSupply(supply.Id, new UpdateSupplyDto
        {
            Lat = 16.0544,
            Lng = 108.2022,
        });

        Assert.IsType<OkObjectResult>(result.Result);
        var updated = await context.SupplyItems.FindAsync(supply.Id);
        Assert.NotNull(updated);
        Assert.Equal(16.0544, updated.CoordinatesLat);
        Assert.Equal(108.2022, updated.CoordinatesLong);
    }

    [Fact]
    public async Task UpdateSupply_rejects_a_partial_coordinate_pair()
    {
        await using var context = CreateContext();
        var supply = CreateSupply();
        context.SupplyItems.Add(supply);
        await context.SaveChangesAsync();
        var controller = CreateController(context);

        var result = await controller.UpdateSupply(supply.Id, new UpdateSupplyDto
        {
            Lat = 16.0544,
        });

        Assert.IsType<BadRequestObjectResult>(result.Result);
        var unchanged = await context.SupplyItems.FindAsync(supply.Id);
        Assert.NotNull(unchanged);
        Assert.Equal(10.762622, unchanged.CoordinatesLat);
        Assert.Equal(106.660172, unchanged.CoordinatesLong);
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        var context = new AppDbContext(options);
        context.Database.EnsureCreated();
        return context;
    }

    private static SupplyController CreateController(AppDbContext context)
        => new(context, new NoOpNotificationService(), NullLogger<SupplyController>.Instance);

    private static SupplyItem CreateSupply()
        => new()
        {
            Name = "Kho cứu trợ",
            Quantity = 25,
            CoordinatesLat = 10.762622,
            CoordinatesLong = 106.660172,
            CreatedAt = DateTime.UtcNow,
        };

    private sealed class NoOpNotificationService : INotificationService
    {
        public Task SendAsync(string userId, string message) => Task.CompletedTask;
        public Task SendToManyAsync(IEnumerable<string> userIds, string message) => Task.CompletedTask;
        public Task SendToRoleAsync(int role, string message) => Task.CompletedTask;
    }
}
