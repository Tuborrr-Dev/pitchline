using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using PitchLine.Application.Common.Exceptions;

namespace PitchLine.API.Extensions;

public static class ApplicationBuilderExtensions
{
    public static void ConfigureExceptionHandler(this WebApplication app)
    {
        app.UseExceptionHandler(errorApp =>
        {
            errorApp.Run(async context =>
            {
                var exceptionHandlerFeature = context.Features.Get<IExceptionHandlerFeature>();
                var exception = exceptionHandlerFeature?.Error;

                var problemDetails = exception switch
                {
                    ValidationException validationException => new ValidationProblemDetails(validationException.Errors)
                    {
                        Status = StatusCodes.Status400BadRequest,
                        Title = "Validation error"
                    },

                    NotFoundException => new ProblemDetails
                    {
                        Status = StatusCodes.Status404NotFound,
                        Title = "Resource not found",
                        Detail = exception.Message
                    },

                    ForbiddenAccessException => new ProblemDetails
                    {
                        Status = StatusCodes.Status403Forbidden,
                        Title = "Forbidden",
                        Detail = exception.Message
                    },

                    _ => new ProblemDetails
                    {
                        Status = StatusCodes.Status500InternalServerError,
                        Title = "Server error",
                        Detail = "An unexpected error occurred."
                    }
                };

                context.Response.StatusCode = problemDetails.Status ?? StatusCodes.Status500InternalServerError;
                context.Response.ContentType = "application/problem+json";

                await context.Response.WriteAsJsonAsync(problemDetails);
            });
        });
    }
}
