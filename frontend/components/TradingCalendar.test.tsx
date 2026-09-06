import {
    cleanup,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";
import {
    afterEach,
    describe,
    expect,
    test,
    vi,
} from "vitest";

import TradingCalendar from "./TradingCalendar";

afterEach(() => {
    cleanup();
});

describe("TradingCalendar", () => {
    test("shows the trading results for each day", () => {
        render(
            <TradingCalendar
                year={2026}
                month={9}
                currency="USD"
                days={[
                    {
                        date: "2026-09-12",
                        total_trades: 2,
                        total_pnl: 100,
                        total_r: 2.5,
                        trades_with_r: 2,
                    },
                    {
                        date: "2026-09-13",
                        total_trades: 1,
                        total_pnl: -50,
                        total_r: -1,
                        trades_with_r: 1,
                    },
                ]}
                onMonthChange={vi.fn()}
            />,
        );

        expect(screen.getByText("September 2026")).toBeInTheDocument();

        expect(
            screen.getByTestId("calendar-day-2026-09-12"),
        ).toHaveTextContent("USD 100.00");

        expect(
            screen.getByTestId("calendar-day-2026-09-12"),
        ).toHaveTextContent("2 trades");

        expect(
            screen.getByTestId("calendar-day-2026-09-13"),
        ).toHaveTextContent("-USD 50.00");
    });

    test("requests the next month", () => {
        const onMonthChange = vi.fn();

        render(
            <TradingCalendar
                year={2026}
                month={9}
                currency="USD"
                days={[]}
                onMonthChange={onMonthChange}
            />,
        );

        fireEvent.click(
            screen.getByRole("button", {
                name: /next month/i,
            }),
        );

        expect(onMonthChange).toHaveBeenCalledWith(2026, 10);
    });

    test("does not show R when it cannot be calculated", () => {
        render(
            <TradingCalendar
                year={2026}
                month={9}
                currency="USD"
                days={[
                    {
                        date: "2026-09-14",
                        total_trades: 1,
                        total_pnl: 25,
                        total_r: null,
                        trades_with_r: 0,
                    },
                ]}
                onMonthChange={vi.fn()}
            />,
        );

        expect(
            screen.getByTestId("calendar-day-2026-09-14"),
        ).toHaveTextContent("USD 25.00");

        expect(screen.queryByText("0.00R")).not.toBeInTheDocument();
    });
});