using Microsoft.AspNetCore.Mvc;
using PitchLine.API.Common.Models;
using PitchLine.Application.Common.Models;

namespace PitchLine.API.Common.Extensions;

public static class ResultExtensions
{
    public static IActionResult ToActionResult<T>(this Result<T> result)
    {
        if (result.IsSuccess)
            return new OkObjectResult(ApiResponse<T>.SuccessResponse(result.Value));

        return new BadRequestObjectResult(
            ApiResponse<object>.FailureResponse(result.Error.Message));
    }

    public static IActionResult ToActionResult(this Result result)
    {
        if (result.IsSuccess)
            return new OkObjectResult(ApiResponse<object>.SuccessResponse(null!));

        return new BadRequestObjectResult(
            ApiResponse<object>.FailureResponse(result.Error.Message));
    }
}
