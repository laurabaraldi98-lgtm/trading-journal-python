"use client";

import { DayButton, DayPicker, type DayButtonProps } from "react-day-picker";
import "react-day-picker/style.css";

export type TradingCalendarDay = {
    date: string;
    total_trades: number;
    total_pnl: number;
    total_r: number | null;
    trades_with_r: number;
};

type TradingCalendarProps = {
    year: number;
    month: number;
    currency: string;
    days: TradingCalendarDay[];
    onMonthChange: (year: number, month: number) => void;
};

function dateToKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatPnl(value: number, currency: string) {
    const sign = value < 0 ? "-" : "";
    return `${sign}${currency} ${Math.abs(value).toFixed(2)}`;
}

export default function TradingCalendar({
    year,
    month,
    currency,
    days,
    onMonthChange,
}: TradingCalendarProps) {
    const daysByDate = new Map(days.map((day) => [day.date, day]));

    // JavaScript months are zero-based: January is 0 and December is 11.
    const displayedMonth = new Date(year, month - 1, 1);

    function TradingDayButton(props: DayButtonProps) {
        const { day, modifiers, ...buttonProps } = props;
        const dateKey = dateToKey(day.date);
        const statistics = daysByDate.get(dateKey);
        let resultClasses = "bg-white text-slate-700 hover:bg-slate-50";

        if (statistics && statistics.total_pnl > 0) {
            resultClasses = "bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
        } else if (statistics && statistics.total_pnl < 0) {
            resultClasses = "bg-red-50 text-red-700 hover:bg-red-100";
        }

        return (
            <DayButton
                {...buttonProps}
                day={day}
                modifiers={modifiers}
                className={`${resultClasses} flex min-h-20 w-full flex-col items-start justify-start gap-0.5 rounded-none p-1 text-left sm:min-h-24 sm:gap-1 sm:p-2`}
                data-testid={statistics ? `calendar-day-${dateKey}` : undefined}
            >
                <span className="text-[10px] font-semibold sm:text-xs">
                    {day.date.getDate()}
                </span>

                {statistics && (
                    <>
                        <span className="break-words text-[9px] font-bold leading-tight sm:text-sm">
                            {formatPnl(statistics.total_pnl, currency)}
                        </span>

                        <span className="text-[9px] leading-tight sm:text-xs">
                            {statistics.total_trades}{" "}
                            {statistics.total_trades === 1 ? "trade" : "trades"}
                        </span>

                        {statistics.total_r !== null && (
                            <span className="text-[9px] font-medium leading-tight sm:text-xs">
                                {statistics.total_r.toFixed(2)}R
                            </span>
                        )}
                    </>
                )}
            </DayButton>
        );
    }

    return (
        <section
            aria-label="Trading calendar"
            className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5"
        >
            <DayPicker
                // Makes each calendar day use our custom TradingDayButton.
                mode="single"
                month={displayedMonth}
                onMonthChange={(nextMonth) =>
                    onMonthChange(
                        nextMonth.getFullYear(),
                        nextMonth.getMonth() + 1,
                    )
                }
                showOutsideDays
                components={{ DayButton: TradingDayButton }}
                className="relative w-full"
                classNames={{
                    months: "w-full",
                    month: "w-full space-y-4",
                    month_caption: "flex h-10 items-center justify-center",
                    caption_label: "text-base font-semibold text-slate-900 sm:text-lg",
                    nav: "absolute right-0 top-0 flex gap-1 sm:gap-2",
                    button_previous: "rounded-lg border border-slate-200 p-1.5 hover:bg-slate-100 sm:p-2",
                    button_next: "rounded-lg border border-slate-200 p-1.5 hover:bg-slate-100 sm:p-2",
                    month_grid: "w-full table-fixed border-collapse",
                    weekday: "pb-2 text-center text-[10px] font-semibold uppercase text-slate-500 sm:text-xs",
                    day: "border border-slate-200 p-0 align-top",
                    outside: "opacity-40",
                    today: "ring-2 ring-inset ring-blue-400",
                }}
            />
        </section>
    );
}