def generate_rule_annotation(request):

    if request.eventType == "goal":
        return (
            f"{request.teamCode} scores, moving the market by "
            f"{request.probability_delta:+.1f}%."
        )
    if request.eventType == "yellow_card":
        return f"{request.playerName} receives a yellow card as the market remains largely stable."
    if request.matchPhase == "HT":
        return "Half-time whistle."
    if request.matchPhase == "FT":
        return (
            f"Full time — final probability: "
            f"{request.teamCode} {request.probability.teamA:.1f}%."
        )
    if request.matchPhase == "ET1":
        return "Extra time — draw collapses"
    if request.matchPhase == "PE":
        return "Penalty shootout."
    return f"{request.eventType.capitalize()} recorded."
