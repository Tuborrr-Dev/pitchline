FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 5050

ENV ASPNETCORE_URLS=http://+:5050

USER app
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG configuration=Release
WORKDIR /src
COPY ["match-engine/PitchLine.API/PitchLine.API.csproj", "match-engine/PitchLine.API/"]
RUN dotnet restore "match-engine/PitchLine.API/PitchLine.API.csproj"
COPY . .
WORKDIR "/src/match-engine/PitchLine.API"
RUN dotnet build "PitchLine.API.csproj" -c $configuration -o /app/build

FROM build AS publish
ARG configuration=Release
RUN dotnet publish "PitchLine.API.csproj" -c $configuration -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "PitchLine.API.dll"]
