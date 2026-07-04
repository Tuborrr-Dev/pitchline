def generate_rule_annotation(request):

    if request.eventType == "goal":
        return (
            f"{request.teamCode} scores, moving the market by "
            f"{request.probability_delta:+.1f}%."
        )
    if request.eventType == "yellow_card":
        return f"{request.playerName} receives a yellow card as the market remains largely stable."
    return f"{request.eventType.capitalize()} recorded."
