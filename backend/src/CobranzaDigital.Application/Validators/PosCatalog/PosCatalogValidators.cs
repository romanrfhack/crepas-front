using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.PosCatalog;
using CobranzaDigital.Domain.Entities;
using FluentValidation;

namespace CobranzaDigital.Application.Validators.PosCatalog;

public sealed class UpsertProductRequestValidator : AbstractValidator<UpsertProductRequest>
{
    public UpsertProductRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.BasePrice).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpsertExtraRequestValidator : AbstractValidator<UpsertExtraRequest>
{
    public UpsertExtraRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpsertSelectionGroupRequestValidator : AbstractValidator<UpsertSelectionGroupRequest>
{
    public UpsertSelectionGroupRequestValidator()
    {
        RuleFor(x => x.Key).NotEmpty();
        RuleFor(x => x.Label).NotEmpty();
        RuleFor(x => x.MinSelections).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MaxSelections).GreaterThanOrEqualTo(x => x.MinSelections);
        RuleFor(x => x).Must(x => x.MinSelections == 0 || x.MaxSelections > 0)
            .WithMessage("If MinSelections > 0 then MaxSelections must be > 0.");
        RuleFor(x => x).Must(BeValidSingleMode)
            .WithMessage("Single mode requires MaxSelections = 1 and MinSelections in {0,1}.");
    }

    private static bool BeValidSingleMode(UpsertSelectionGroupRequest request)
    {
        if (request.SelectionMode != SelectionMode.Single)
        {
            return true;
        }

        return request.MaxSelections == 1 && (request.MinSelections == 0 || request.MinSelections == 1);
    }
}

public sealed class ReplaceIncludedItemsRequestValidator : AbstractValidator<ReplaceIncludedItemsRequest>
{
    public ReplaceIncludedItemsRequestValidator()
    {
        RuleForEach(x => x.Items)
            .ChildRules(child => child.RuleFor(x => x.Quantity).GreaterThan(0));
    }
}

public sealed class OverrideUpsertRequestValidator : AbstractValidator<OverrideUpsertRequest>
{
    public OverrideUpsertRequestValidator()
    {
        RuleFor(x => x.AllowedOptionItemIds)
            .Must(ids => ids.Distinct().Count() == ids.Count)
            .WithMessage("No duplicate allowedOptionItemIds.");
    }
}

public static class ValidationExtensions
{
    public static async Task EnsureValidAsync<T>(this IValidator<T> validator, T instance, CancellationToken ct)
    {
        var result = await validator.ValidateAsync(instance, ct);
        if (result.IsValid)
        {
            return;
        }

        var errors = result.Errors
            .GroupBy(x => x.PropertyName)
            .ToDictionary(x => x.Key, x => x.Select(e => e.ErrorMessage).ToArray());

        throw new ValidationException(errors);
    }
}
