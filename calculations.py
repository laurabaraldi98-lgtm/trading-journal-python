import math


MAX_CHART_POINTS = 500


def calculate_r(direction, entry, stop, exit):
    if direction == "long":
        risk = entry - stop
        profit = exit - entry
    else:  # short
        risk = stop - entry
        profit = entry - exit

    if risk == 0:
        raise ValueError("Entry and stop cannot be the same")

    return profit / risk


def sample_chart_points(points):
    if len(points) <= MAX_CHART_POINTS:
        return points

    step = math.ceil(
        (len(points) - 1) / (MAX_CHART_POINTS - 1)
    )
    sampled_points = points[::step]

    if sampled_points[-1] != points[-1]:
        sampled_points.append(points[-1])

    return sampled_points


def calculate_dashboard_statistics(trades):
    total_trades = 0
    winning_trades = 0
    total_pnl = 0.0
    total_r = 0.0
    trades_with_r = 0
    pnl_curve = []
    r_curve = []

    for trade in trades:
        pnl = float(trade["pnl"])
        result = trade["result"]

        total_trades += 1
        total_pnl += pnl

        if pnl > 0:
            winning_trades += 1

        pnl_curve.append({
            "trade_number": total_trades,
            "value": total_pnl,
        })

        if result is not None:
            total_r += float(result)
            trades_with_r += 1
            r_curve.append({
                "trade_number": trades_with_r,
                "value": total_r,
            })

    win_rate = (
        winning_trades / total_trades * 100
        if total_trades > 0
        else 0.0
    )
    average_r = (
        total_r / trades_with_r
        if trades_with_r > 0
        else None
    )

    return {
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "total_pnl": total_pnl,
        "total_r": total_r if trades_with_r > 0 else None,
        "trades_with_r": trades_with_r,
        "win_rate": win_rate,
        "average_r": average_r,
        "performance": {
            "r": sample_chart_points(r_curve),
            "pnl": sample_chart_points(pnl_curve),
        },
    }


def calculate_calendar_statistics(trades):
    days = {}
    total_trades = 0
    total_pnl = 0.0
    total_r = 0.0
    trades_with_r = 0

    for trade in trades:
        trade_date = trade["entry_datetime"][:10]
        pnl = float(trade["pnl"])
        result = trade["result"]

        if trade_date not in days:
            days[trade_date] = {
                "total_trades": 0,
                "total_pnl": 0.0,
                "total_r": 0.0,
                "trades_with_r": 0,
            }

        day = days[trade_date]
        day["total_trades"] += 1
        day["total_pnl"] += pnl

        total_trades += 1
        total_pnl += pnl

        if result is not None:
            numeric_result = float(result)
            day["total_r"] += numeric_result
            day["trades_with_r"] += 1
            total_r += numeric_result
            trades_with_r += 1

    calendar_days = []

    for trade_date, day in sorted(days.items()):
        calendar_days.append({
            "date": trade_date,
            "total_trades": day["total_trades"],
            "total_pnl": day["total_pnl"],
            "total_r": (
                day["total_r"]
                if day["trades_with_r"] > 0
                else None
            ),
            "trades_with_r": day["trades_with_r"],
        })

    return {
        "total_trades": total_trades,
        "trading_days": len(calendar_days),
        "total_pnl": total_pnl,
        "total_r": total_r if trades_with_r > 0 else None,
        "trades_with_r": trades_with_r,
        "days": calendar_days,
    }
