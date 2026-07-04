# this layer confirms if the data is significant enough for AI call or not
def is_significant(request):
    AI_EVENTS = {
        "own_goal",
        "penalty",
        "penalty_goal",
        "penalty_missed",
        "penalty_saved",
        "red_card",
        "second_yellow_red",
        "goal_disallowed",
        "var_goal_overturned",
        "var_penalty_overturned",
    }
    if (
        abs(request.probability_delta) >= 15
    ):  # <-- significance is defined as a probability delta of 15% or more
        return True
    if request.matchContext.isComeback:
        return True
    if request.matchContext.isLateGoal:
        return True
    if request.matchContext.isEqualiser:
        return True
    if request.matchContext.isWinningGoal:
        return True
    if request.eventType == "penalty":
        return True
    if request.eventType in AI_EVENTS:
        return True
    return False
